import { createHmac, timingSafeEqual } from 'node:crypto'

export const WORKSPACE_SESSION_TTL_MS = 30 * 60 * 1000

export type WorkspaceSession = {
  workspaceId: string
  expiresAt: string
}

type WorkspaceSessionPayload = {
  version: 1
  workspaceId: string
  expiresAt: number
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const SIGNING_CONTEXT = 'ai-lms/workspace-session/v1'

export function encodeWorkspaceSession(
  session: WorkspaceSession,
  secret: string,
): string {
  assertSecret(secret)
  const expiresAt = Date.parse(session.expiresAt)
  if (!UUID_PATTERN.test(session.workspaceId) || !Number.isFinite(expiresAt)) {
    throw new Error('Workspace session is invalid')
  }

  const payload: WorkspaceSessionPayload = {
    version: 1,
    workspaceId: session.workspaceId,
    expiresAt,
  }
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${encodedPayload}.${sign(encodedPayload, secret).toString('base64url')}`
}

export function decodeWorkspaceSession(
  token: string | undefined,
  secret: string,
  now = Date.now(),
): WorkspaceSession | null {
  assertSecret(secret)
  if (!token || token.length > 1024) return null

  const parts = token.split('.')
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null

  let providedSignature: Buffer
  try {
    providedSignature = Buffer.from(parts[1], 'base64url')
  } catch {
    return null
  }
  const expectedSignature = sign(parts[0], secret)
  if (
    providedSignature.length !== expectedSignature.length ||
    !timingSafeEqual(providedSignature, expectedSignature)
  ) {
    return null
  }

  let payload: unknown
  try {
    payload = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'))
  } catch {
    return null
  }
  if (!isWorkspaceSessionPayload(payload) || payload.expiresAt <= now) return null

  return {
    workspaceId: payload.workspaceId,
    expiresAt: new Date(payload.expiresAt).toISOString(),
  }
}

function sign(payload: string, secret: string): Buffer {
  const signingKey = createHmac('sha256', secret)
    .update(SIGNING_CONTEXT)
    .digest()
  return createHmac('sha256', signingKey).update(payload).digest()
}

function assertSecret(secret: string): void {
  if (Buffer.byteLength(secret, 'utf8') < 32) {
    throw new Error('Workspace session signing is not configured')
  }
}

function isWorkspaceSessionPayload(value: unknown): value is WorkspaceSessionPayload {
  if (value === null || typeof value !== 'object') return false
  const payload = value as Partial<WorkspaceSessionPayload>
  return (
    payload.version === 1 &&
    typeof payload.workspaceId === 'string' &&
    UUID_PATTERN.test(payload.workspaceId) &&
    typeof payload.expiresAt === 'number' &&
    Number.isSafeInteger(payload.expiresAt)
  )
}
