import 'server-only'

import { randomUUID } from 'node:crypto'

import { NextResponse } from 'next/server'

const MAX_BODY_BYTES = 8 * 1024
const NO_STORE_HEADERS = {
  'Cache-Control': 'private, no-store',
  Pragma: 'no-cache',
}

export type ApiContext = { requestId: string }

export async function authorizeCanvasApi(
  request: Request,
): Promise<ApiContext | NextResponse> {
  const requestId = randomUUID()
  if (!isSameOrigin(request)) {
    return apiError('invalid_input', 'Same-origin request required', requestId, 403)
  }
  return { requestId }
}

export async function readBoundedJson(
  request: Request,
  requestId: string,
): Promise<unknown | NextResponse> {
  const declaredLength = request.headers.get('content-length')
  if (declaredLength && Number(declaredLength) > MAX_BODY_BYTES) {
    return apiError('invalid_input', 'Request body is too large', requestId, 413)
  }
  const text = await request.text()
  if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) {
    return apiError('invalid_input', 'Request body is too large', requestId, 413)
  }
  try {
    return JSON.parse(text) as unknown
  } catch {
    return apiError('invalid_input', 'Request body must be valid JSON', requestId, 400)
  }
}

export async function callCanvasImportService(
  path: '/v1/canvas/courses' | '/v1/canvas/import',
  body: Record<string, string>,
  context: ApiContext,
) {
  const serviceToken = process.env.CANVAS_IMPORT_SERVICE_TOKEN
  const configuredUrl = process.env.CANVAS_IMPORT_SERVICE_URL
  if (!serviceToken || serviceToken.length < 32 || !configuredUrl) {
    return apiError(
      'internal_failure',
      'Canvas import service is not configured',
      context.requestId,
      503,
    )
  }

  let endpoint: URL
  try {
    const base = new URL(configuredUrl)
    const localDevelopment =
      process.env.NODE_ENV !== 'production' &&
      base.protocol === 'http:' &&
      (base.hostname === '127.0.0.1' || base.hostname === 'localhost')
    if (base.protocol !== 'https:' && !localDevelopment) throw new Error('unsafe')
    if (base.username || base.password || base.search || base.hash) throw new Error('unsafe')
    endpoint = new URL(path, base)
  } catch {
    return apiError(
      'internal_failure',
      'Canvas import service is not configured',
      context.requestId,
      503,
    )
  }

  try {
    const upstream = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Canvas-Import-Service-Token': serviceToken,
        'X-Request-ID': context.requestId,
      },
      body: JSON.stringify(body),
      cache: 'no-store',
      signal: AbortSignal.timeout(305_000),
    })
    const text = await upstream.text()
    if (new TextEncoder().encode(text).byteLength > 64 * 1024) {
      return apiError(
        'internal_failure',
        'Canvas import service returned an invalid response',
        context.requestId,
        502,
      )
    }
    let payload: unknown
    try {
      payload = JSON.parse(text)
    } catch {
      payload = null
    }
    if (!isRecord(payload)) {
      return apiError(
        'internal_failure',
        'Canvas import service returned an invalid response',
        context.requestId,
        502,
      )
    }
    return NextResponse.json(payload, {
      status: upstream.status,
      headers: NO_STORE_HEADERS,
    })
  } catch (error) {
    const timeout = error instanceof Error && error.name === 'TimeoutError'
    return apiError(
      timeout ? 'timeout' : 'unreachable_canvas',
      timeout
        ? 'Canvas import did not finish within five minutes'
        : 'Canvas import service could not be reached',
      context.requestId,
      timeout ? 504 : 502,
    )
  }
}

export function apiError(
  code: string,
  message: string,
  requestId: string,
  status: number,
) {
  return NextResponse.json(
    { error: { code, message, requestId } },
    { status, headers: NO_STORE_HEADERS },
  )
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin')
  if (!origin) return false
  try {
    return new URL(origin).origin === new URL(request.url).origin
  } catch {
    return false
  }
}
