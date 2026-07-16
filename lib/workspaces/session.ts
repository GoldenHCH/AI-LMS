import 'server-only'

import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

import {
  decodeWorkspaceSession,
  encodeWorkspaceSession,
  type WorkspaceSession,
} from './sessionToken'

export const WORKSPACE_SESSION_COOKIE = 'ai_lms_workspace'

export async function getWorkspaceSession(): Promise<WorkspaceSession | null> {
  const cookieStore = await cookies()
  const secret = workspaceSessionSecret()
  if (Buffer.byteLength(secret, 'utf8') < 32) return null
  return decodeWorkspaceSession(
    cookieStore.get(WORKSPACE_SESSION_COOKIE)?.value,
    secret,
  )
}

export function setWorkspaceSessionCookie(
  response: NextResponse,
  session: WorkspaceSession,
): void {
  const expires = new Date(session.expiresAt)
  response.cookies.set(
    WORKSPACE_SESSION_COOKIE,
    encodeWorkspaceSession(session, workspaceSessionSecret()),
    {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      path: '/',
      expires,
      maxAge: Math.max(0, Math.ceil((expires.getTime() - Date.now()) / 1000)),
    },
  )
}

export function clearWorkspaceSessionCookie(response: NextResponse): void {
  response.cookies.set(WORKSPACE_SESSION_COOKIE, '', {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    path: '/',
    expires: new Date(0),
    maxAge: 0,
  })
}

function workspaceSessionSecret(): string {
  return process.env.CANVAS_IMPORT_SERVICE_TOKEN ?? ''
}
