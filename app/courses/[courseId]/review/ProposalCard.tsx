'use client'

import { useState } from 'react'

import type { ReviewProposal } from '@/lib/changes/review'

import { PageDetail } from '../ItemDetail'

export function ProposalCard({
  proposal,
  onAccept,
  onReject,
}: {
  proposal: ReviewProposal
  onAccept: () => void | Promise<void>
  onReject: () => void | Promise<void>
}) {
  const [confirmed, setConfirmed] = useState(false)
  const [busy, setBusy] = useState(false)
  const decided = proposal.status !== 'proposed'
  const acceptDisabled = busy || decided || (proposal.isSensitive && !confirmed)

  async function handle(action: () => void | Promise<void>) {
    setBusy(true)
    try {
      await action()
    } finally {
      setBusy(false)
    }
  }

  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-panel">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex min-h-6 items-center rounded-full bg-ocean/10 px-2.5 py-0.5 text-xs font-semibold text-ocean">
              {proposal.kind === 'page' ? 'Page' : 'Quiz'}
            </span>
            {proposal.isSensitive ? (
              <span className="inline-flex min-h-6 items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-900">
                Affects grading
              </span>
            ) : null}
            {decided ? (
              <span className="inline-flex min-h-6 items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                {proposal.status === 'accepted' ? 'Accepted' : 'Rejected'}
              </span>
            ) : null}
          </div>
          <h3 className="mt-1.5 text-lg font-semibold text-ink">{proposal.itemTitle}</h3>
          <p className="mt-1 text-sm leading-6 text-slate-600">{proposal.rationale}</p>
        </div>
      </header>

      <div className="px-5 py-5">
        {proposal.kind === 'page' && proposal.beforePage && proposal.afterPage ? (
          <PageDiffView before={proposal.beforePage} after={proposal.afterPage} />
        ) : null}
        {proposal.kind === 'quiz' && proposal.diff?.kind === 'quiz' ? (
          <QuizDiffView diff={proposal.diff} />
        ) : null}
        {!proposal.diff ? (
          <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
            This item could not be found for review — it may have been removed since the request was made.
          </p>
        ) : null}
      </div>

      {proposal.isSensitive && !decided ? (
        <div className="mx-5 mb-5 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950">
          <p className="text-sm font-semibold">This change affects grading</p>
          <p className="mt-1 text-sm leading-6 text-amber-900">
            Check the correct answer, points, or question count above carefully before accepting.
          </p>
          <label className="mt-3 flex min-h-11 items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
              className="h-5 w-5 rounded border-amber-400 text-ocean focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ocean"
            />
            I&rsquo;ve reviewed this grading change
          </label>
        </div>
      ) : null}

      {!decided ? (
        <div className="flex flex-wrap gap-3 border-t border-slate-200 px-5 py-4">
          <button
            type="button"
            onClick={() => handle(onAccept)}
            disabled={acceptDisabled}
            aria-label={`Accept change to ${proposal.itemTitle}`}
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-white transition hover:bg-ocean focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ocean disabled:cursor-not-allowed disabled:opacity-50"
          >
            Accept
          </button>
          <button
            type="button"
            onClick={() => handle(onReject)}
            disabled={busy}
            aria-label={`Reject change to ${proposal.itemTitle}`}
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ocean disabled:cursor-not-allowed disabled:opacity-50"
          >
            Reject
          </button>
        </div>
      ) : null}
    </article>
  )
}

function PageDiffView({
  before,
  after,
}: {
  before: NonNullable<ReviewProposal['beforePage']>
  after: NonNullable<ReviewProposal['afterPage']>
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div>
        <p className="eyebrow mb-2">Before</p>
        <div className="rounded-xl border border-slate-200">
          <PageDetail page={before} />
        </div>
      </div>
      <div>
        <p className="eyebrow mb-2">After</p>
        <div className="rounded-xl border border-ocean/30 bg-ocean/5">
          <PageDetail page={after} />
        </div>
      </div>
    </div>
  )
}

function QuizDiffView({ diff }: { diff: Extract<NonNullable<ReviewProposal['diff']>, { kind: 'quiz' }> }) {
  const touched = diff.questions
  if (touched.length === 0) {
    return <p className="text-sm text-slate-600">No question-level changes.</p>
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500">
        Only the {touched.length} question{touched.length === 1 ? '' : 's'} this request touches are shown below.
      </p>
      {touched.map((question) => (
        <div key={question.questionId} className="rounded-xl border border-slate-200 p-4">
          {question.removed ? (
            <p className="inline-flex min-h-6 items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-800">
              Question removed
            </p>
          ) : null}

          {question.stemHtml?.changed ? (
            <div className="mt-2 grid gap-3 md:grid-cols-2">
              <HtmlBefore label="Stem before" html={question.stemHtml.before} />
              <HtmlAfter label="Stem after" html={question.stemHtml.after} />
            </div>
          ) : null}

          {question.pointsPossible?.changed ? (
            <p className="mt-2 text-sm text-slate-700">
              Points:{' '}
              <span className="line-through text-slate-500">{question.pointsPossible.before ?? '—'}</span>{' '}
              → <span className="font-semibold text-ink">{question.pointsPossible.after ?? '—'}</span>
            </p>
          ) : null}

          {question.answers.length > 0 ? (
            <ul className="mt-3 space-y-2">
              {question.answers.map((answer) => (
                <li key={answer.answerId} className="rounded-lg bg-slate-50 p-3 text-sm">
                  {answer.textHtml?.changed ? (
                    <div className="grid gap-2 md:grid-cols-2">
                      <HtmlBefore label="Answer before" html={answer.textHtml.before} />
                      <HtmlAfter label="Answer after" html={answer.textHtml.after} />
                    </div>
                  ) : null}
                  {answer.isCorrect?.changed ? (
                    <p className="mt-1 text-slate-700">
                      Correct:{' '}
                      <span className="line-through text-slate-500">
                        {answer.isCorrect.before ? 'yes' : 'no'}
                      </span>{' '}
                      → <span className="font-semibold text-ink">{answer.isCorrect.after ? 'yes' : 'no'}</span>
                    </p>
                  ) : null}
                  {answer.weight?.changed ? (
                    <p className="mt-1 text-slate-700">
                      Weight:{' '}
                      <span className="line-through text-slate-500">{answer.weight.before ?? '—'}%</span> →{' '}
                      <span className="font-semibold text-ink">{answer.weight.after ?? '—'}%</span>
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ))}
    </div>
  )
}

function HtmlBefore({ label, html }: { label: string; html: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">{label}</p>
      <div
        className="rich-content compact mt-1 rounded-lg border border-slate-200 bg-slate-50 p-2 text-sm"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  )
}

function HtmlAfter({ label, html }: { label: string; html: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">{label}</p>
      <div
        className="rich-content compact mt-1 rounded-lg border border-ocean/30 bg-ocean/5 p-2 text-sm"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  )
}
