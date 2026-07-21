'use client'

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-5">
      <div className="max-w-lg rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-panel">
        <p className="eyebrow">Could not load courses</p>
        <h1 className="mt-3 text-3xl font-semibold text-ink">The course workspace hit a snag.</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">Check the Supabase connection and try the request again.</p>
        <button type="button" onClick={reset} className="mt-6 min-h-11 rounded-xl bg-ink px-5 py-2 text-sm font-semibold text-white focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ocean">Try again</button>
      </div>
    </main>
  )
}
