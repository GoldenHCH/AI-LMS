'use client'

import Link from 'next/link'
import { useRef, useState } from 'react'

import type { CourseItem, CourseTree as CourseTreeData } from '@/lib/courses/getCourseTree'

import { CourseTree } from './CourseTree'
import { ItemDetail } from './ItemDetail'

export function CourseView({ course }: { course: CourseTreeData }) {
  const items = course.modules.flatMap((module) => module.items)
  const [selectedItemId, setSelectedItemId] = useState<string | null>(
    () => items[0]?.id ?? null,
  )
  const detailRef = useRef<HTMLElement>(null)
  const selectedItem =
    items.find((item) => item.id === selectedItemId) ?? items[0] ?? null

  function selectItem(item: CourseItem) {
    setSelectedItemId(item.id)
    window.requestAnimationFrame(() => detailRef.current?.focus())
  }

  return (
    <main className="min-h-screen px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
      <div className="mx-auto max-w-[1540px]">
        <header className="mb-4 rounded-3xl border border-slate-200 bg-white px-5 py-5 shadow-panel sm:px-7 sm:py-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <Link
                href="/"
                aria-label="Back to all courses"
                className="mt-1 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-600 transition hover:border-ocean/40 hover:bg-ocean/5 hover:text-ocean focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ocean"
              >
                <BackIcon />
              </Link>
              <div>
                <p className="eyebrow">Canvas {course.canvasCourseId}</p>
                <h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-ink sm:text-4xl">
                  {course.name}
                </h1>
              </div>
            </div>

            <dl className="grid grid-cols-2 overflow-hidden rounded-2xl border border-slate-200 bg-mist sm:min-w-80">
              <Count label="Modules" value={course.moduleCount} />
              <Count label="Items" value={course.itemCount} border />
            </dl>
          </div>
        </header>

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

function BackIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" aria-hidden="true">
      <path d="m12.5 4.5-5.5 5.5 5.5 5.5M7.5 10H17" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
