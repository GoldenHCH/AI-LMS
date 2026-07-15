import Link from 'next/link'

import { listCourseSummaries } from '@/lib/courses/getCourseTree'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const courses = await listCourseSummaries()

  return (
    <main className="min-h-screen px-5 py-8 sm:px-8 lg:px-12 lg:py-12">
      <div className="mx-auto max-w-6xl">
        <header className="mb-10 flex flex-col gap-6 border-b border-slate-200 pb-8 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="eyebrow">Canvas course editor</p>
            <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-[-0.035em] text-ink sm:text-5xl">
              Imported courses, exactly as they arrived.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
              Inspect every module, page, quiz, file, and unsupported item before making a change.
            </p>
          </div>
          <div className="w-fit rounded-full border border-ocean/20 bg-ocean/5 px-4 py-2 text-sm font-medium text-ocean">
            {courses.length} {pluralize('course', courses.length)} imported
          </div>
        </header>

        {courses.length ? (
          <section aria-labelledby="course-list-heading">
            <div className="mb-5 flex items-center justify-between">
              <h2 id="course-list-heading" className="text-lg font-semibold text-ink">
                Course workspace
              </h2>
              <p className="text-sm text-slate-500">Select a course to inspect its structure</p>
            </div>
            <ul className="grid gap-5 md:grid-cols-2">
              {courses.map((course, index) => (
                <li key={course.id}>
                  <Link
                    href={`/courses/${course.id}`}
                    className="group relative flex min-h-52 flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-panel transition hover:-translate-y-0.5 hover:border-ocean/40 hover:shadow-xl focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-ocean"
                  >
                    <span
                      className="absolute right-5 top-4 text-7xl font-semibold tracking-tighter text-slate-100 transition group-hover:text-ocean/10"
                      aria-hidden="true"
                    >
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <div className="relative">
                      <span className="inline-flex rounded-full bg-sun/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-amber-800">
                        Canvas {course.canvasCourseId}
                      </span>
                      <h3 className="mt-6 max-w-md text-2xl font-semibold tracking-tight text-ink">
                        {course.name}
                      </h3>
                    </div>
                    <div className="relative mt-auto flex items-center justify-between pt-8">
                      <p className="text-sm text-slate-600">
                        {course.moduleCount} {pluralize('module', course.moduleCount)}
                        <span className="mx-2 text-slate-300" aria-hidden="true">
                          ·
                        </span>
                        {course.itemCount} {pluralize('item', course.itemCount)}
                      </p>
                      <span className="inline-flex items-center gap-2 text-sm font-semibold text-ocean">
                        Open course
                        <ArrowIcon />
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : (
          <section className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center shadow-panel">
            <p className="text-lg font-semibold text-ink">No imported courses yet</p>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">
              Run the fixture seed script to populate this development workspace with the two sample Canvas courses.
            </p>
            <code className="mt-5 inline-block rounded-lg bg-slate-900 px-4 py-2 text-sm text-slate-100">
              python backend/scripts/seed_supabase.py
            </code>
          </section>
        )}
      </div>
    </main>
  )
}

function pluralize(word: string, count: number) {
  return count === 1 ? word : `${word}s`
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" aria-hidden="true">
      <path d="M4 10h11M11 6l4 4-4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
