import { NextResponse } from 'next/server'

import { apiError, authorizeCanvasApi, isRecord, readBoundedJson } from '@/lib/canvas/importService'
import { getCourseTree } from '@/lib/courses/getCourseTree'
import { getWorkspaceSession } from '@/lib/workspaces/session'
import { toAgentContext } from '@/lib/agent/dto'
import { PRE_FILTER_ITEM_CAP, prefilterCourseTree } from '@/lib/agent/prefilter'
import {
  AgentRefusalError,
  EmptyResponseError,
  SchemaValidationError,
  callAgent,
} from '@/lib/agent/client'
import { createChangeBatch, type ProposalToPersist } from '@/lib/changes/changeBatch'
import { computeProposalDiff } from '@/lib/changes/diff'
import { buildReviewProposals } from '@/lib/changes/review'

export const runtime = 'nodejs'

const MAX_REQUEST_TEXT_LENGTH = 2000

type RouteParams = { params: Promise<{ courseId: string }> }

export async function POST(request: Request, { params }: RouteParams) {
  const context = await authorizeCanvasApi(request)
  if (context instanceof NextResponse) return context

  const session = await getWorkspaceSession()
  if (!session) {
    return apiError('unauthenticated', 'No active course workspace', context.requestId, 401)
  }

  const payload = await readBoundedJson(request, context.requestId)
  if (payload instanceof NextResponse) return payload
  if (!isRecord(payload) || typeof payload.requestText !== 'string') {
    return apiError('invalid_input', 'requestText is required', context.requestId, 400)
  }
  const requestText = payload.requestText.trim()
  if (!requestText) {
    return apiError('invalid_input', 'requestText cannot be empty', context.requestId, 400)
  }
  if (requestText.length > MAX_REQUEST_TEXT_LENGTH) {
    return apiError(
      'invalid_input',
      `requestText must be ${MAX_REQUEST_TEXT_LENGTH} characters or fewer`,
      context.requestId,
      400,
    )
  }

  const { courseId } = await params
  const tree = await getCourseTree(courseId, session.workspaceId)
  if (!tree) {
    return apiError('not_found', 'Course workspace not found or expired', context.requestId, 404)
  }

  const prefilterResult = prefilterCourseTree(tree, requestText)
  if (prefilterResult.status === 'zero-match') {
    return NextResponse.json({
      status: 'clarification',
      question:
        "I couldn't find any pages or quizzes matching that request. Try mentioning a specific page title, quiz title, or module name.",
    })
  }
  if (prefilterResult.status === 'too-broad') {
    return NextResponse.json({
      status: 'too-broad',
      matchCount: prefilterResult.matchCount,
      itemCap: PRE_FILTER_ITEM_CAP,
    })
  }

  const filteredItems = prefilterResult.items
  const agentItems = filteredItems
    .map((match) => toAgentContext(match.item))
    .filter((item) => item !== null)

  let agentResponse
  try {
    agentResponse = await callAgent({ requestText, items: agentItems })
  } catch (error) {
    if (error instanceof AgentRefusalError) {
      return apiError('agent_refusal', 'The agent declined this request', context.requestId, 422)
    }
    if (error instanceof EmptyResponseError || error instanceof SchemaValidationError) {
      return apiError(
        'agent_invalid_response',
        'The agent could not produce a valid response — try again',
        context.requestId,
        502,
      )
    }
    return apiError('agent_unreachable', 'The agent could not be reached', context.requestId, 502)
  }

  if (agentResponse.type === 'clarification') {
    return NextResponse.json({ status: 'clarification', question: agentResponse.question })
  }

  const itemsById = new Map(filteredItems.map((match) => [match.item.id, match.item]))
  const kept: ProposalToPersist[] = []
  let droppedCount = agentResponse.malformedCount

  for (const proposal of agentResponse.batch) {
    const item = itemsById.get(proposal.itemId)
    if (!item) {
      droppedCount += 1
      continue
    }
    const diffResult = computeProposalDiff(item, proposal)
    if (diffResult.status === 'dropped') {
      droppedCount += 1
      continue
    }
    kept.push({ proposal, isSensitive: diffResult.diff.isSensitive })
  }

  if (kept.length === 0) {
    return apiError(
      'no_valid_proposals',
      'None of the proposed changes could be safely applied — try rephrasing your request',
      context.requestId,
      422,
    )
  }

  const batch = await createChangeBatch(courseId, session.workspaceId, requestText, kept)
  if (!batch) {
    return apiError('not_found', 'Course workspace not found or expired', context.requestId, 404)
  }

  return NextResponse.json({
    status: 'batch',
    batchId: batch.id,
    proposals: buildReviewProposals(tree, batch.proposals),
    droppedCount,
  })
}
