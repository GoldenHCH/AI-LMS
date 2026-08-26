import { randomUUID } from 'node:crypto'

import { NextResponse } from 'next/server'

import { apiError } from '@/lib/canvas/importService'
import { getCourseTree } from '@/lib/courses/getCourseTree'
import { getWorkspaceSession } from '@/lib/workspaces/session'
import { getChangeBatch } from '@/lib/changes/changeBatch'
import { buildReviewProposals } from '@/lib/changes/review'

export const runtime = 'nodejs'

type RouteParams = { params: Promise<{ courseId: string; batchId: string }> }

// Read-only: no same-origin/CSRF check here (unlike the state-changing chat
// and batch-action routes). Browsers don't reliably send an Origin header on
// plain same-origin GET fetches, and a GET has no side effects to protect —
// the workspace-cookie's SameSite=Strict already blocks cross-site senders,
// same posture as the Server Component page that reads this data directly.
export async function GET(request: Request, { params }: RouteParams) {
  const requestId = randomUUID()

  const session = await getWorkspaceSession()
  if (!session) {
    return apiError('unauthenticated', 'No active course workspace', requestId, 401)
  }

  const { courseId, batchId } = await params

  const [tree, batch] = await Promise.all([
    getCourseTree(courseId, session.workspaceId),
    getChangeBatch(batchId, courseId, session.workspaceId),
  ])
  if (!tree || !batch) {
    return apiError('not_found', 'Change batch not found or expired', requestId, 404)
  }

  return NextResponse.json({
    status: 'batch',
    batchId: batch.id,
    requestText: batch.requestText,
    proposals: buildReviewProposals(tree, batch.proposals),
  })
}
