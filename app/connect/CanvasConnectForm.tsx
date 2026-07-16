'use client'

import { useRouter } from 'next/navigation'
import { FormEvent, useRef, useState } from 'react'

type CanvasUser = { canvasUserId: string; name: string }
type CanvasCourse = { canvasCourseId: string; name: string }
type CoursesResponse = { user: CanvasUser; courses: CanvasCourse[] }
type ImportResponse = { courseUuid: string; partial: boolean; expiresAt: string }
type ErrorEnvelope = { error?: { message?: string; requestId?: string } }

export function CanvasConnectForm() {
  const router = useRouter()
  const [baseUrl, setBaseUrl] = useState('')
  const [accessToken, setAccessToken] = useState('')
  const [canvasUser, setCanvasUser] = useState<CanvasUser | null>(null)
  const [courses, setCourses] = useState<CanvasCourse[]>([])
  const [selectedCourseId, setSelectedCourseId] = useState('')
  const [busy, setBusy] = useState<'connect' | 'import' | null>(null)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const errorRef = useRef<HTMLDivElement>(null)
  const coursesRef = useRef<HTMLFieldSetElement>(null)

  async function connect(event: FormEvent) {
    event.preventDefault()
    setError('')
    setBusy('connect')
    setStatus('Validating Canvas access and loading instructor-manageable courses…')
    try {
      const response = await fetch('/api/canvas/courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({ baseUrl, accessToken }),
      })
      const payload = (await response.json()) as CoursesResponse & ErrorEnvelope
      if (!response.ok || !validCoursesResponse(payload)) {
        throw new Error(errorMessage(payload, 'Canvas could not be connected.'))
      }
      setCanvasUser(payload.user)
      setCourses(payload.courses)
      setSelectedCourseId(payload.courses[0]?.canvasCourseId ?? '')
      setStatus(
        payload.courses.length
          ? `${payload.courses.length} instructor-manageable ${payload.courses.length === 1 ? 'course' : 'courses'} loaded.`
          : 'Connected successfully, but no active teacher, TA, or designer courses were found.',
      )
      window.requestAnimationFrame(() => coursesRef.current?.focus())
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Canvas could not be connected.')
      setStatus('')
      window.requestAnimationFrame(() => errorRef.current?.focus())
    } finally {
      setBusy(null)
    }
  }

  async function importCourse(event: FormEvent) {
    event.preventDefault()
    if (!selectedCourseId) {
      setError('Choose a course to import.')
      window.requestAnimationFrame(() => coursesRef.current?.focus())
      return
    }
    setError('')
    setBusy('import')
    setStatus('Importing modules, pages, quizzes, files, and unsupported placeholders…')
    try {
      const response = await fetch('/api/canvas/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({
          baseUrl,
          accessToken,
          canvasCourseId: selectedCourseId,
        }),
      })
      const payload = (await response.json()) as ImportResponse & ErrorEnvelope
      if (!response.ok || !validImportResponse(payload)) {
        throw new Error(errorMessage(payload, 'The course could not be imported.'))
      }
      setStatus(payload.partial ? 'Partial import completed with review warnings.' : 'Import complete.')
      setAccessToken('')
      setBaseUrl('')
      router.replace(`/courses/${payload.courseUuid}`)
      router.refresh()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The course could not be imported.')
      setStatus('')
      setBusy(null)
      window.requestAnimationFrame(() => errorRef.current?.focus())
    }
  }

  function resetConnection() {
    setAccessToken('')
    setBaseUrl('')
    setCanvasUser(null)
    setCourses([])
    setSelectedCourseId('')
    setStatus('Canvas connection reset. The Canvas URL and access token were cleared.')
    setError('')
  }

  return (
    <div className="mx-auto max-w-4xl">
      <header className="border-b border-slate-200 pb-8">
        <p className="eyebrow">Secure Canvas import</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-[-0.035em] text-ink sm:text-5xl">
          Connect a Canvas course
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
          Enter your Canvas URL and personal access token for this visit. Neither
          credential is saved. After import, the temporary course workspace is
          deleted automatically after 30 minutes.
        </p>
      </header>

      <div aria-live="polite" className="mt-5 min-h-6 text-sm font-medium text-slate-600">
        {status}
      </div>
      {error ? (
        <div
          ref={errorRef}
          tabIndex={-1}
          role="alert"
          className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-900 outline-none focus-visible:ring-4 focus-visible:ring-red-200"
        >
          {error}
        </div>
      ) : null}

      {!canvasUser ? (
        <form autoComplete="off" onSubmit={connect} className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-panel sm:p-8">
          <fieldset disabled={busy !== null} className="space-y-6 disabled:opacity-70">
            <legend className="text-xl font-semibold text-ink">Canvas connection</legend>
            <div>
              <label htmlFor="canvas-base-url" className="block text-sm font-semibold text-ink">
                Canvas base URL
              </label>
              <p id="canvas-base-help" className="mt-1 text-sm text-slate-500">
                Enter only the HTTPS origin, such as https://school.instructure.com.
              </p>
              <input
                id="canvas-base-url"
                type="url"
                inputMode="url"
                autoComplete="off"
                aria-describedby="canvas-base-help"
                required
                maxLength={255}
                value={baseUrl}
                onChange={(event) => setBaseUrl(event.target.value)}
                className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-4 py-3 text-base text-ink outline-none focus:border-ocean focus:ring-4 focus:ring-ocean/15"
              />
            </div>
            <div>
              <label htmlFor="canvas-pat" className="block text-sm font-semibold text-ink">
                Canvas personal access token
              </label>
              <p id="canvas-pat-help" className="mt-1 text-sm text-slate-500">
                The token remains only in this tab’s transient form state until import or reset.
              </p>
              <input
                id="canvas-pat"
                type="password"
                autoComplete="off"
                spellCheck={false}
                aria-describedby="canvas-pat-help"
                required
                minLength={8}
                maxLength={4096}
                value={accessToken}
                onChange={(event) => setAccessToken(event.target.value)}
                className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-4 py-3 text-base text-ink outline-none focus:border-ocean focus:ring-4 focus:ring-ocean/15"
              />
            </div>
            <button
              type="submit"
              className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-ocean px-5 py-3 text-sm font-semibold text-white transition hover:bg-teal-800 focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-ocean disabled:cursor-wait"
            >
              {busy === 'connect' ? 'Connecting…' : 'Connect and choose a course'}
            </button>
          </fieldset>
        </form>
      ) : (
        <form onSubmit={importCourse} className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-panel sm:p-8">
          <div className="flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-slate-500">Connected Canvas user</p>
              <p className="mt-1 text-lg font-semibold text-ink">{canvasUser.name}</p>
            </div>
            <button
              type="button"
              onClick={resetConnection}
              disabled={busy !== null}
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-ocean"
            >
              Reset and clear token
            </button>
          </div>

          <fieldset
            ref={coursesRef}
            tabIndex={-1}
            disabled={busy !== null || courses.length === 0}
            className="mt-7 outline-none focus-visible:ring-4 focus-visible:ring-ocean/15"
          >
            <legend className="text-xl font-semibold text-ink">Choose one course to import</legend>
            {courses.length ? (
              <div className="mt-4 space-y-3">
                {courses.map((course) => (
                  <label
                    key={course.canvasCourseId}
                    className="flex min-h-11 cursor-pointer items-center gap-4 rounded-2xl border border-slate-200 p-4 transition hover:border-ocean/40 has-[:checked]:border-ocean has-[:checked]:bg-ocean/5"
                  >
                    <input
                      type="radio"
                      name="canvas-course"
                      value={course.canvasCourseId}
                      checked={selectedCourseId === course.canvasCourseId}
                      onChange={(event) => setSelectedCourseId(event.target.value)}
                      className="h-5 w-5 accent-ocean"
                    />
                    <span>
                      <span className="block font-semibold text-ink">{course.name}</span>
                      <span className="mt-1 block text-sm text-slate-500">Canvas course {course.canvasCourseId}</span>
                    </span>
                  </label>
                ))}
              </div>
            ) : (
              <p className="mt-4 rounded-2xl bg-mist p-5 text-sm leading-6 text-slate-600">
                No active teacher, TA, or designer enrollments were returned by Canvas.
              </p>
            )}
          </fieldset>

          <button
            type="submit"
            disabled={busy !== null || !selectedCourseId}
            className="mt-7 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-ocean px-5 py-3 text-sm font-semibold text-white transition hover:bg-teal-800 focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-ocean disabled:cursor-not-allowed disabled:opacity-55"
          >
            {busy === 'import' ? 'Importing course…' : 'Import selected course'}
          </button>
        </form>
      )}
    </div>
  )
}

function validCoursesResponse(value: unknown): value is CoursesResponse {
  if (value === null || typeof value !== 'object') return false
  const record = value as Partial<CoursesResponse>
  return (
    record.user !== null &&
    typeof record.user === 'object' &&
    typeof record.user.canvasUserId === 'string' &&
    typeof record.user.name === 'string' &&
    Array.isArray(record.courses) &&
    record.courses.every(
      (course) =>
        course !== null &&
        typeof course === 'object' &&
        typeof course.canvasCourseId === 'string' &&
        typeof course.name === 'string',
    )
  )
}

function validImportResponse(value: unknown): value is ImportResponse {
  if (value === null || typeof value !== 'object') return false
  const record = value as Partial<ImportResponse>
  return (
    typeof record.courseUuid === 'string' &&
    typeof record.partial === 'boolean' &&
    typeof record.expiresAt === 'string' &&
    Number.isFinite(Date.parse(record.expiresAt))
  )
}

function errorMessage(value: ErrorEnvelope, fallback: string) {
  const message = value.error?.message
  const requestId = value.error?.requestId
  return `${message || fallback}${requestId ? ` (request ${requestId})` : ''}`
}
