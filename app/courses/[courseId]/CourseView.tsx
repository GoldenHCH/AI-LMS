'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

import type { CourseItem, CourseTree as CourseTreeData } from '@/lib/courses/getCourseTree'

import { CourseTree } from './CourseTree'
import { ItemDetail } from './ItemDetail'

export function CourseView({ course }: { course: CourseTreeData }) {
  const router = useRouter()
  const items = course.modules.flatMap((module) => module.items)
  const [selectedItemId, setSelectedItemId] = useState<string | null>(
    () => items[0]?.id ?? null,
  )
  const [remaining, setRemaining] = useState('30:00')
  const [expired, setExpired] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [disconnectError, setDisconnectError] = useState('')
  const detailRef = useRef<HTMLElement>(null)
  const expiryHandledRef = useRef(false)
  const selectedItem =
    items.find((item) => item.id === selectedItemId) ?? items[0] ?? null

  useEffect(() => {
    const deadline = Date.parse(course.expiresAt)
    function expireWorkspace() {
      if (expiryHandledRef.current) return
      expiryHandledRef.current = true
      setRemaining('0:00')
      setExpired(true)
      router.replace('/')
      router.refresh()
    }

    function updateRemaining() {
      const remainingMs = Math.max(0, deadline - Date.now())
      const minutes = Math.floor(remainingMs / 60_000)
      const seconds = Math.floor((remainingMs % 60_000) / 1000)
      setRemaining(`${minutes}:${String(seconds).padStart(2, '0')}`)
      if (remainingMs === 0) expireWorkspace()
    }

    updateRemaining()
    const interval = window.setInterval(updateRemaining, 1000)
    const timeout = window.setTimeout(
      expireWorkspace,
      Math.max(0, deadline - Date.now()),
    )
    return () => {
      window.clearInterval(interval)
      window.clearTimeout(timeout)
    }
  }, [course.expiresAt, router])

  function selectItem(item: CourseItem) {
    setSelectedItemId(item.id)
    window.requestAnimationFrame(() => detailRef.current?.focus())
  }

  async function disconnect() {
    setDisconnecting(true)
    setDisconnectError('')
    try {
      const response = await fetch('/api/workspace/disconnect', {
        method: 'POST',
        cache: 'no-store',
      })
      if (!response.ok) {
        throw new Error('The workspace could not be deleted. Please try again.')
      }
      router.replace('/')
      router.refresh()
    } catch (caught) {
      setDisconnectError(
        caught instanceof Error
          ? caught.message
          : 'The workspace could not be deleted. Please try again.',
      )
      setDisconnecting(false)
    }
  }

  if (expired) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6 text-center">
        <div role="status" className="rounded-3xl border border-slate-200 bg-white p-8 shadow-panel">
          <h1 className="text-2xl font-semibold text-ink">Workspace expired</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            The temporary course has been cleared. Returning to the Canvas connection screen…
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
      <div className="mx-auto max-w-[1540px]">
        <header className="mb-4 rounded-3xl border border-slate-200 bg-white px-5 py-5 shadow-panel sm:px-7 sm:py-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="eyebrow">Canvas {course.canvasCourseId}</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-ink sm:text-4xl">
                {course.name}
              </h1>
            </div>

            <div className="flex flex-col gap-3 sm:items-end">
              <p className="text-sm font-medium text-slate-600">
                Temporary workspace ·{' '}
                <span
                  role="timer"
                  aria-label={`Workspace time remaining ${remaining}`}
                  className="font-semibold tabular-nums text-ink"
                >
                  {remaining}
                </span>{' '}
                remaining
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <dl className="grid grid-cols-2 overflow-hidden rounded-2xl border border-slate-200 bg-mist sm:min-w-80">
                  <Count label="Modules" value={course.moduleCount} />
                  <Count label="Items" value={course.itemCount} border />
                </dl>
                <a
                  href={`/courses/${course.id}/review`}
                  className="inline-flex min-h-11 items-center justify-center rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-white transition hover:bg-ocean focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-ocean"
                >
                  Chat with agent
                </a>
                <button
                  type="button"
                  onClick={disconnect}
                  disabled={disconnecting}
                  className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-ocean disabled:cursor-wait disabled:opacity-60"
                >
                  {disconnecting ? 'Disconnecting…' : 'Disconnect and delete'}
                </button>
              </div>
            </div>
          </div>
        </header>

        {disconnectError ? (
          <div
            role="alert"
            className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900"
          >
            {disconnectError}
          </div>
        ) : null}

        {course.importStatus === 'partial' ? (
          <section
            role="status"
            aria-labelledby="partial-import-heading"
            className="mb-4 rounded-3xl border border-amber-300 bg-amber-50 px-5 py-5 text-amber-950 shadow-panel sm:px-7"
          >
            <h2 id="partial-import-heading" className="text-lg font-semibold">
              This course import is partial
            </h2>
            <p className="mt-2 text-sm leading-6">
              The available course tree was preserved, including placeholders for items Canvas could not return. Review these issues before editing or exporting.
            </p>
            {course.importIssues.length ? (
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm leading-6">
                {course.importIssues.map((issue, index) => (
                  <li key={`${issue.phase}-${issue.canvasId ?? 'none'}-${index}`}>
                    {issue.message}
                    {issue.canvasId ? ` (Canvas item ${issue.canvasId})` : ''}
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        ) : null}

        <div className="grid min-h-[calc(100vh-11rem)] gap-4 lg:grid-cols-[23rem_minmax(0,1fr)]">
          <aside className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-panel" aria-label="Course structure">
            <div className="border-b border-slate-200 px-5 py-5">
              <p className="eyebrow">Course structure</p>
              <h2 className="mt-2 text-lg font-semibold text-ink">Modules and items</h2>
            </div>
            <CourseTree
              modules={course.modules}
              selectedItemId={selectedItem?.id ?? null}
              onSelect={selectItem}
            />
          </aside>

          <section
            ref={detailRef}
            tabIndex={-1}
            aria-label="Selected course item"
            className="min-w-0 rounded-3xl border border-slate-200 bg-white shadow-panel outline-none focus-visible:ring-[3px] focus-visible:ring-ocean/30"
          >
            {selectedItem ? (
              <ItemDetail item={selectedItem} />
            ) : (
              <div className="flex min-h-96 items-center justify-center p-8 text-center">
                <div>
                  <p className="text-lg font-semibold text-ink">This course has no items</p>
                  <p className="mt-2 text-sm text-slate-600">Imported modules will appear in the tree.</p>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  )
}

function Count({ label, value, border = false }: { label: string; value: number; border?: boolean }) {
  return (
    <div className={`px-5 py-3 ${border ? 'border-l border-slate-200' : ''}`}>
      <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</dt>
      <dd className="mt-1 text-2xl font-semibold text-ink">{value}</dd>
    </div>
  )
}
