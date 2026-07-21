import Link from 'next/link'

export default function CourseNotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center px-5">
      <div className="max-w-lg rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-panel">
        <p className="eyebrow">Course not found</p>
        <h1 className="mt-3 text-3xl font-semibold text-ink">This imported course is unavailable.</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">It may have been replaced, expired, or removed from the development workspace.</p>
        <Link href="/" className="mt-6 inline-flex min-h-11 items-center rounded-xl bg-ink px-5 py-2 text-sm font-semibold text-white focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ocean">Back to courses</Link>
      </div>
    </main>
  )
}
