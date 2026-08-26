import { NextResponse } from 'next/server'

import { apiError, authorizeCanvasApi } from '@/lib/canvas/importService'
import { getWorkspaceSession } from '@/lib/workspaces/session'
import { acceptProposals, getChangeBatch } from '@/lib/changes/changeBatch'

export const runtime = 'nodejs'

type RouteParams = { params: Promise<{ courseId: string; batchId: string }> }

export async function POST(request: Request, { params }: RouteParams) {
  const context = await authorizeCanvasApi(request)
  if (context instanceof NextResponse) return context

  const session = await getWorkspaceSession()
  if (!session) {
    return apiError('unauthenticated', 'No active course workspace', context.requestId, 401)
  }

  const { courseId, batchId } = await params

  const batch = await getChangeBatch(batchId, courseId, session.workspaceId)
  if (!batch) {
    return apiError('not_found', 'Change batch not found or expired', context.requestId, 404)
  }

  // "Accept N non-sensitive proposals" (D2): excludes the entire proposal if
  // ANY field is sensitive, not just the sensitive field (T2). Only
  // still-pending proposals are eligible; the RPC re-checks proposed-state
  // (T3) regardless.
  const eligibleIds = batch.proposals
    .filter((proposal) => proposal.status === 'proposed' && !proposal.isSensitive)
    .map((proposal) => proposal.id)

  if (eligibleIds.length === 0) {
    return NextResponse.json({ status: 'accepted', results: [] })
  }

  const results = await acceptProposals(eligibleIds, batchId, courseId, session.workspaceId)
  if (results === null) {
    return apiError('not_found', 'Change batch not found or expired', context.requestId, 404)
  }

  return NextResponse.json({ status: 'accepted', results })
}
