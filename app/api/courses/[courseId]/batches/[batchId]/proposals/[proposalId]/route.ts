import { NextResponse } from 'next/server'

import { apiError, authorizeCanvasApi, isRecord, readBoundedJson } from '@/lib/canvas/importService'
import { getWorkspaceSession } from '@/lib/workspaces/session'
import { acceptProposals, getChangeBatch, rejectProposal } from '@/lib/changes/changeBatch'

export const runtime = 'nodejs'

type RouteParams = {
  params: Promise<{ courseId: string; batchId: string; proposalId: string }>
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const context = await authorizeCanvasApi(request)
  if (context instanceof NextResponse) return context

  const session = await getWorkspaceSession()
  if (!session) {
    return apiError('unauthenticated', 'No active course workspace', context.requestId, 401)
  }

  const payload = await readBoundedJson(request, context.requestId)
  if (payload instanceof NextResponse) return payload
  if (!isRecord(payload) || (payload.action !== 'accept' && payload.action !== 'reject')) {
    return apiError('invalid_input', 'action must be "accept" or "reject"', context.requestId, 400)
  }

  const { courseId, batchId, proposalId } = await params

  if (payload.action === 'reject') {
    const result = await rejectProposal(proposalId, batchId, courseId, session.workspaceId)
    if (result === null) {
      return apiError('not_found', 'Change batch not found or expired', context.requestId, 404)
    }
    return NextResponse.json({ status: result })
  }

  // Quiz-safety guardrail: a sensitive proposal (correct-answer, point-value,
  // or question-count change) must carry explicit confirmation in the
  // request itself, not just a checked checkbox in client state — otherwise
  // a same-origin fetch, a second tab, or a devtools-disabled button could
  // apply a grading change the professor never actually confirmed.
  const currentBatch = await getChangeBatch(batchId, courseId, session.workspaceId)
  if (currentBatch === null) {
    return apiError('not_found', 'Change batch not found or expired', context.requestId, 404)
  }
  const target = currentBatch.proposals.find((proposal) => proposal.id === proposalId)
  if (!target) {
    return apiError('not_found', 'Proposal not found in this batch', context.requestId, 404)
  }
  if (target.isSensitive && payload.confirmed !== true) {
    return apiError(
      'confirmation_required',
      'This change affects grading and must be explicitly confirmed before accepting',
      context.requestId,
      400,
    )
  }

  // Server-side proposed-state re-check (T3) happens inside acceptProposals'
  // RPC — a UI in-flight lock alone can't protect against a second tab or a
  // direct API call racing this same action.
  const results = await acceptProposals([proposalId], batchId, courseId, session.workspaceId)
  if (results === null) {
    return apiError('not_found', 'Change batch not found or expired', context.requestId, 404)
  }
  const result = results[0]
  if (!result) {
    return apiError('not_found', 'Proposal not found in this batch', context.requestId, 404)
  }
  return NextResponse.json({ status: result.accepted ? 'accepted' : result.reason })
}
