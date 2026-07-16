import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import test from 'node:test'

import { createClient } from '@supabase/supabase-js'

import { encodeWorkspaceSession } from '../../lib/workspaces/sessionToken.ts'

const COOKIE_NAME = 'ai_lms_workspace'
const RUN_LIVE = process.env.RUN_WORKSPACE_LIVE_TESTS === '1'

test(
  'live app isolates, expires, refreshes, and disconnects workspaces',
  { skip: !RUN_LIVE, timeout: 30_000 },
  async () => {
    const appBaseUrl = process.env.APP_BASE_URL ?? 'http://localhost:3000'
    const supabaseUrl = requiredEnvironment('NEXT_PUBLIC_SUPABASE_URL')
    const secretKey = requiredEnvironment('SUPABASE_SECRET_KEY')
    const signingSecret = requiredEnvironment('CANVAS_IMPORT_SERVICE_TOKEN')
    const workspaceA = randomUUID()
    const workspaceB = randomUUID()
    const expiresAt = new Date(Date.now() + 5 * 60_000).toISOString()
    const supabase = createClient(supabaseUrl, secretKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    let courseIds: string[] = []

    try {
      const { data, error } = await supabase
        .from('courses')
        .insert([
          {
            canvas_course_id: 'workspace-verification-a',
            name: 'Workspace verification A',
            workspace_id: workspaceA,
            expires_at: expiresAt,
          },
          {
            canvas_course_id: 'workspace-verification-b',
            name: 'Workspace verification B',
            workspace_id: workspaceB,
            expires_at: expiresAt,
          },
        ])
        .select('id,workspace_id')
      assert.equal(error, null)
      assert.equal(data?.length, 2)
      courseIds = data?.map((row) => row.id) ?? []
      const courseA = requiredCourseId(data, workspaceA)
      const courseB = requiredCourseId(data, workspaceB)

      const root = await fetch(appBaseUrl, { cache: 'no-store' })
      const rootHtml = await root.text()
      assert.equal(root.status, 200)
      assert.match(rootHtml, /id="canvas-base-url"/)
      assert.match(rootHtml, /id="canvas-pat"/)
      assert.doesNotMatch(rootHtml, /previously imported|saved courses/i)

      await assertRedirectsHome(fetchCourse(appBaseUrl, courseA))

      const sessionToken = encodeWorkspaceSession(
        { workspaceId: workspaceA, expiresAt },
        signingSecret,
      )
      const cookie = `${COOKIE_NAME}=${sessionToken}`
      for (let refresh = 0; refresh < 2; refresh += 1) {
        const ownWorkspace = await fetchCourse(appBaseUrl, courseA, cookie)
        assert.equal(ownWorkspace.status, 200)
        assert.equal(ownWorkspace.headers.get('set-cookie'), null)
      }

      await assertRedirectsHome(fetchCourse(appBaseUrl, courseB, cookie))

      const expiredToken = encodeWorkspaceSession(
        {
          workspaceId: workspaceA,
          expiresAt: new Date(Date.now() - 1).toISOString(),
        },
        signingSecret,
      )
      await assertRedirectsHome(
        fetchCourse(appBaseUrl, courseA, `${COOKIE_NAME}=${expiredToken}`),
      )

      const forgedToken = `${sessionToken.slice(0, -1)}${
        sessionToken.endsWith('a') ? 'b' : 'a'
      }`
      await assertRedirectsHome(
        fetchCourse(appBaseUrl, courseA, `${COOKIE_NAME}=${forgedToken}`),
      )

      const disconnect = await fetch(`${appBaseUrl}/api/workspace/disconnect`, {
        method: 'POST',
        redirect: 'manual',
        headers: { Cookie: cookie, Origin: appBaseUrl },
      })
      assert.equal(disconnect.status, 204)
      assert.match(disconnect.headers.get('set-cookie') ?? '', /Max-Age=0/i)

      const { data: remaining, error: remainingError } = await supabase
        .from('courses')
        .select('workspace_id')
        .in('id', courseIds)
      assert.equal(remainingError, null)
      assert.deepEqual(remaining?.map((row) => row.workspace_id), [workspaceB])
    } finally {
      if (courseIds.length) {
        await supabase.from('courses').delete().in('id', courseIds)
      }
    }
  },
)

function fetchCourse(appBaseUrl: string, courseId: string, cookie?: string) {
  return fetch(`${appBaseUrl}/courses/${courseId}`, {
    cache: 'no-store',
    redirect: 'manual',
    headers: cookie ? { Cookie: cookie } : undefined,
  })
}

async function assertRedirectsHome(responsePromise: Promise<Response>) {
  const response = await responsePromise
  assert.ok([303, 307, 308].includes(response.status))
  assert.equal(new URL(response.headers.get('location') ?? '', 'http://local').pathname, '/')
}

function requiredCourseId(
  rows: { id: string; workspace_id: string }[] | null,
  workspaceId: string,
) {
  const courseId = rows?.find((row) => row.workspace_id === workspaceId)?.id
  assert.ok(courseId)
  return courseId
}

function requiredEnvironment(name: string) {
  const value = process.env[name]
  assert.ok(value, `${name} is required`)
  return value
}
