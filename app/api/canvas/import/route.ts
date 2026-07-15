import { NextResponse } from 'next/server'

import {
  apiError,
  authorizeCanvasApi,
  callCanvasImportService,
  isRecord,
  readBoundedJson,
} from '@/lib/canvas/importService'

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
  return callCanvasImportService(
    '/v1/canvas/import',
    {
      baseUrl: payload.baseUrl,
      accessToken: payload.accessToken,
      canvasCourseId: String(payload.canvasCourseId),
    },
    context,
  )
}
