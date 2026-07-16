import assert from 'node:assert/strict'
import test from 'node:test'

import {
  decodeWorkspaceSession,
  encodeWorkspaceSession,
  type WorkspaceSession,
} from '../../lib/workspaces/sessionToken.ts'

const SECRET = 'workspace-signing-secret-at-least-32-bytes'
const OTHER_SECRET = 'different-signing-secret-at-least-32-bytes'
const NOW = Date.parse('2026-07-15T20:00:00.000Z')
const SESSION: WorkspaceSession = {
  workspaceId: '11111111-1111-4111-8111-111111111111',
  expiresAt: '2026-07-15T20:30:00.000Z',
}

test('workspace session round-trips before the fixed deadline', () => {
  const token = encodeWorkspaceSession(SESSION, SECRET)

  assert.deepEqual(decodeWorkspaceSession(token, SECRET, NOW), SESSION)
})

test('workspace session expires exactly at its deadline', () => {
  const token = encodeWorkspaceSession(SESSION, SECRET)

  assert.equal(
    decodeWorkspaceSession(token, SECRET, Date.parse(SESSION.expiresAt)),
    null,
  )
})

test('workspace session rejects tampering and the wrong signing secret', () => {
  const token = encodeWorkspaceSession(SESSION, SECRET)
  const tampered = `${token.slice(0, -1)}${token.endsWith('a') ? 'b' : 'a'}`

  assert.equal(decodeWorkspaceSession(tampered, SECRET, NOW), null)
  assert.equal(decodeWorkspaceSession(token, OTHER_SECRET, NOW), null)
})

test('workspace session contains no Canvas credentials', () => {
  const token = encodeWorkspaceSession(SESSION, SECRET)
  const payload = JSON.parse(
    Buffer.from(token.split('.')[0], 'base64url').toString('utf8'),
  ) as Record<string, unknown>

  assert.deepEqual(Object.keys(payload).sort(), [
    'expiresAt',
    'version',
    'workspaceId',
  ])
})
