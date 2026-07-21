import { NextResponse } from 'next/server'

import {
  apiError,
  authorizeCanvasApi,
  NO_STORE_HEADERS,
} from '@/lib/canvas/importService'
import { deleteWorkspace } from '@/lib/workspaces/data'
import {
  clearWorkspaceSessionCookie,
  getWorkspaceSession,
} from '@/lib/workspaces/session'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const context = await authorizeCanvasApi(request)
  if (context instanceof NextResponse) return context

  const session = await getWorkspaceSession()
  if (session) {
    try {
      await deleteWorkspace(session.workspaceId)
    } catch {
      return apiError(
        'persistence_failure',
        'The course workspace could not be cleared',
        context.requestId,
        503,
      )
    }
  }

  const response = new NextResponse(null, {
    status: 204,
    headers: NO_STORE_HEADERS,
  })
  clearWorkspaceSessionCookie(response)
  return response
}
