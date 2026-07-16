import { randomUUID } from 'node:crypto'

import { NextResponse } from 'next/server'

import {
  apiError,
  authorizeCanvasApi,
  callCanvasImportService,
  isRecord,
  NO_STORE_HEADERS,
  readBoundedJson,
} from '@/lib/canvas/importService'
import { deleteWorkspace } from '@/lib/workspaces/data'
import {
  getWorkspaceSession,
  setWorkspaceSessionCookie,
} from '@/lib/workspaces/session'
import { WORKSPACE_SESSION_TTL_MS } from '@/lib/workspaces/sessionToken'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const context = await authorizeCanvasApi(request)
  if (context instanceof NextResponse) return context
  const payload = await readBoundedJson(request, context.requestId)
  if (payload instanceof NextResponse) return payload
  if (
    !isRecord(payload) ||
    typeof payload.baseUrl !== 'string' ||
    typeof payload.accessToken !== 'string' ||
    (typeof payload.canvasCourseId !== 'string' &&
      typeof payload.canvasCourseId !== 'number')
  ) {
    return apiError(
      'invalid_input',
      'Canvas URL, access token, and course are required',
      context.requestId,
      400,
    )
  }
  const previousSession = await getWorkspaceSession()
  const workspaceId = randomUUID()
  const response = await callCanvasImportService(
    '/v1/canvas/import',
    {
      baseUrl: payload.baseUrl,
      accessToken: payload.accessToken,
      canvasCourseId: String(payload.canvasCourseId),
      workspaceId,
    },
    context,
  )
  if (!response.ok) return response

  let importResult: unknown
  try {
    importResult = await response.clone().json()
  } catch {
    importResult = null
  }
  if (!validImportResult(importResult)) {
    await safeDeleteWorkspace(workspaceId)
    return apiError(
      'internal_failure',
      'Canvas import service returned an invalid response',
      context.requestId,
      502,
    )
  }

  const remainingLifetime = Date.parse(importResult.expiresAt) - Date.now()
  if (
    !Number.isFinite(remainingLifetime) ||
    remainingLifetime < WORKSPACE_SESSION_TTL_MS - 60_000 ||
    remainingLifetime > WORKSPACE_SESSION_TTL_MS + 60_000
  ) {
    await safeDeleteWorkspace(workspaceId)
    return apiError(
      'internal_failure',
      'Canvas import service returned an invalid workspace deadline',
      context.requestId,
      502,
    )
  }

  if (previousSession && previousSession.workspaceId !== workspaceId) {
    try {
      await deleteWorkspace(previousSession.workspaceId)
    } catch {
      await safeDeleteWorkspace(workspaceId)
      return apiError(
        'persistence_failure',
        'The previous course workspace could not be cleared',
        context.requestId,
        503,
      )
    }
  }

  const clientResponse = NextResponse.json(
    {
      courseUuid: importResult.courseUuid,
      partial: importResult.partial,
      expiresAt: importResult.expiresAt,
    },
    { headers: NO_STORE_HEADERS },
  )
  setWorkspaceSessionCookie(clientResponse, {
    workspaceId,
    expiresAt: importResult.expiresAt,
  })
  return clientResponse
}

function validImportResult(
  value: unknown,
): value is { courseUuid: string; partial: boolean; expiresAt: string } {
  if (!isRecord(value)) return false
  return (
    typeof value.courseUuid === 'string' &&
    typeof value.partial === 'boolean' &&
    typeof value.expiresAt === 'string'
  )
}

async function safeDeleteWorkspace(workspaceId: string): Promise<void> {
  try {
    await deleteWorkspace(workspaceId)
  } catch {
    // The database expiry job remains the final cleanup backstop.
  }
}
