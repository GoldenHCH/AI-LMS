import type { CourseItem } from '@/lib/courses/getCourseTree'

export function ItemDetail({ item }: { item: CourseItem }) {
  if (item.page) {
    return <PageDetail item={item} />
  }
  if (item.quiz) {
    return <QuizDetail item={item} />
  }
  if (item.file) {
    return <FileDetail item={item} />
  }
  return <OpaqueDetail item={item} />
}

function PageDetail({ item }: { item: CourseItem }) {
  const page = item.page!
  return (
    <article>
      <DetailHeader eyebrow="Page" title={page.title}>
        <StatusPill>{page.published === true ? 'Published' : page.published === false ? 'Unpublished' : 'Status unknown'}</StatusPill>
        {page.frontPage ? <StatusPill accent>Front page</StatusPill> : null}
      </DetailHeader>
      <div className="px-5 py-7 sm:px-8 lg:px-10">
        {page.bodyHtml ? (
          <div className="rich-content" dangerouslySetInnerHTML={{ __html: page.bodyHtml }} />
        ) : (
          <EmptyContent>Canvas returned an empty page body.</EmptyContent>
        )}
      </div>
    </article>
  )
}

function QuizDetail({ item }: { item: CourseItem }) {
  const quiz = item.quiz!
  return (
    <article>
      <DetailHeader eyebrow="Quiz" title={quiz.title}>
        <StatusPill accent>{quiz.engine === 'classic' ? 'Classic Quiz' : 'New Quiz'}</StatusPill>
        <StatusPill>{formatPoints(quiz.pointsPossible)}</StatusPill>
        <StatusPill>{quiz.questionCount} {quiz.questionCount === 1 ? 'question' : 'questions'}</StatusPill>
      </DetailHeader>

      <div className="space-y-6 px-5 py-7 sm:px-8 lg:px-10">
        {quiz.readOnlyReason ? <ReadOnlyBanner reason={quiz.readOnlyReason} /> : null}
        {quiz.descriptionHtml ? (
          <section aria-labelledby="quiz-description-heading" className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <h3 id="quiz-description-heading" className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Instructions</h3>
            <div className="rich-content mt-3" dangerouslySetInnerHTML={{ __html: quiz.descriptionHtml }} />
          </section>
        ) : null}

        <section aria-labelledby="questions-heading">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <p className="eyebrow">Assessment content</p>
              <h3 id="questions-heading" className="mt-1 text-xl font-semibold text-ink">Questions</h3>
            </div>
            <span className="text-sm text-slate-500">Canvas order preserved</span>
          </div>

          <ol className="space-y-5">
            {quiz.questions.map((question, index) => (
              <li key={question.id} className="overflow-hidden rounded-2xl border border-slate-200">
                <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-ink text-sm font-semibold text-white" aria-hidden="true">{index + 1}</span>
                    <div>
                      <p className="text-sm font-semibold text-ink">Question {index + 1}</p>
                      <p className="mt-0.5 text-xs text-slate-500">{humanize(question.questionType)}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusPill>{formatPoints(question.pointsPossible)}</StatusPill>
                    {question.readOnlyReason ? <ReadOnlyTag /> : null}
                  </div>
                </div>
                <div className="p-5 sm:p-6">
                  {question.readOnlyReason ? (
                    <p className="mb-4 flex items-start gap-2 rounded-xl bg-slate-100 px-3 py-2 text-xs leading-5 text-slate-600">
                      <LockIcon />
                      <span>{question.readOnlyReason}</span>
                    </p>
                  ) : null}
                  {question.stemHtml ? (
                    <div className="rich-content" dangerouslySetInnerHTML={{ __html: question.stemHtml }} />
                  ) : (
                    <EmptyContent>No editable question stem was returned for this Canvas item.</EmptyContent>
                  )}

                  {question.answers.length ? (
                    <div className="mt-6">
                      <h4 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Answers</h4>
                      <ol className="mt-3 space-y-2">
                        {question.answers.map((answer, answerIndex) => (
                          <li key={answer.id} className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${answer.isCorrect ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-white'}`}>
                            <span className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${answer.isCorrect ? 'bg-emerald-700 text-white' : 'bg-slate-100 text-slate-600'}`} aria-hidden="true">
                              {answer.isCorrect ? <CheckIcon /> : String.fromCharCode(65 + answerIndex)}
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="rich-content compact" dangerouslySetInnerHTML={{ __html: answer.textHtml }} />
                              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                                {answer.isCorrect ? <span className="font-semibold text-emerald-800">✓ Correct answer</span> : <span className="text-slate-500">Not marked correct</span>}
                                {answer.weight !== null ? <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-600">Weight {answer.weight}%</span> : null}
                              </div>
                              {answer.commentsHtml ? <div className="rich-content compact mt-3 border-l-2 border-slate-200 pl-3 text-sm text-slate-600" dangerouslySetInnerHTML={{ __html: answer.commentsHtml }} /> : null}
                            </div>
                          </li>
                        ))}
                      </ol>
                    </div>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </article>
  )
}

function FileDetail({ item }: { item: CourseItem }) {
  const file = item.file!
  return (
    <article>
      <DetailHeader eyebrow="File" title={file.displayName}>
        <ReadOnlyTag />
      </DetailHeader>
      <div className="px-5 py-7 sm:px-8 lg:px-10">
        <div className="max-w-2xl rounded-2xl border border-slate-200 bg-slate-50 p-6">
          <div className="flex items-start gap-4">
            <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-200 text-slate-600"><FileIcon /></span>
            <div className="min-w-0">
              <p className="font-semibold text-ink">{file.displayName}</p>
              <p className="mt-1 text-sm text-slate-500">{file.contentType ?? 'Unknown file type'}</p>
              <p className="mt-4 text-sm leading-6 text-slate-600">Read-only — file content is not editable in the MVP.</p>
              {file.url ? (
                <a href={file.url} target="_blank" rel="noopener noreferrer" className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-white transition hover:bg-ocean focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ocean">
                  Open Canvas file <ExternalIcon />
                </a>
              ) : (
                <p className="mt-5 text-sm font-medium text-slate-500">Canvas did not provide a safe file URL.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </article>
  )
}

function OpaqueDetail({ item }: { item: CourseItem }) {
  const canvasType = typeof item.opaque?.type === 'string' ? item.opaque.type : 'Unknown Canvas type'
  return (
    <article>
      <DetailHeader eyebrow="Unsupported item" title={item.title}>
        <ReadOnlyTag />
      </DetailHeader>
      <div className="px-5 py-7 sm:px-8 lg:px-10">
        <div className="max-w-2xl rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Canvas item type</p>
          <p className="mt-2 text-lg font-semibold text-ink">{canvasType}</p>
          <p className="mt-4 text-sm leading-6 text-slate-600">Unsupported item type (read-only). Its original Canvas payload is preserved so it will not be dropped during round trip.</p>
        </div>
      </div>
    </article>
  )
}

function DetailHeader({ eyebrow, title, children }: { eyebrow: string; title: string; children: React.ReactNode }) {
  return (
    <header className="border-b border-slate-200 px-5 py-6 sm:px-8 lg:px-10">
      <p className="eyebrow">{eyebrow}</p>
      <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <h2 className="text-3xl font-semibold tracking-[-0.03em] text-ink">{title}</h2>
        <div className="flex flex-wrap gap-2">{children}</div>
      </div>
    </header>
  )
}

function ReadOnlyBanner({ reason }: { reason: string }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950" role="note">
      <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-200"><LockIcon /></span>
      <div><p className="text-sm font-semibold">Read-only quiz</p><p className="mt-1 text-sm leading-6 text-amber-900">{reason}</p></div>
    </div>
  )
}

function StatusPill({ children, accent = false }: { children: React.ReactNode; accent?: boolean }) {
  return <span className={`inline-flex min-h-7 items-center rounded-full px-3 py-1 text-xs font-semibold ${accent ? 'bg-ocean/10 text-ocean' : 'bg-slate-100 text-slate-600'}`}>{children}</span>
}

function ReadOnlyTag() {
  return <span className="inline-flex min-h-7 items-center gap-1.5 rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-700"><LockIcon /> Read-only</span>
}

function EmptyContent({ children }: { children: React.ReactNode }) {
  return <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">{children}</p>
}

function formatPoints(points: number | null) {
  if (points === null) return 'Points not set'
  return `${points} ${points === 1 ? 'point' : 'points'}`
}

function humanize(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (character) => character.toUpperCase())
}

function LockIcon() {
  return <svg viewBox="0 0 16 16" className="h-4 w-4 shrink-0" fill="none" aria-hidden="true"><rect x="3.5" y="7" width="9" height="6.5" rx="1.3" stroke="currentColor" strokeWidth="1.3" /><path d="M5.5 7V5.3a2.5 2.5 0 0 1 5 0V7" stroke="currentColor" strokeWidth="1.3" /></svg>
}

function CheckIcon() {
  return <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" aria-hidden="true"><path d="m3.5 8.2 2.8 2.8 6.2-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
}

function FileIcon() {
  return <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden="true"><path d="M6 3.5h7l5 5V20a1 1 0 0 1-1 1H6.8a.8.8 0 0 1-.8-.8V3.5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /><path d="M13 3.5V9h5" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /></svg>
}

function ExternalIcon() {
  return <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" aria-hidden="true"><path d="M11 4h5v5M9 11l7-7M15 11v4a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
}
