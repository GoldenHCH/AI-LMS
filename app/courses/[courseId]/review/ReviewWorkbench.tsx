'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'

import type { ReviewProposal } from '@/lib/changes/review'

import { ProposalCard } from './ProposalCard'

type ChatMessage = {
  role: 'user' | 'agent' | 'error'
  text: string
}

type Batch = {
  batchId: string
  requestText: string
  proposals: ReviewProposal[]
}

type CountdownLevel = 'quiet' | 'warning' | 'critical'

export function ReviewWorkbench({
  courseId,
  courseName,
  expiresAt,
}: {
  courseId: string
  courseName: string
  expiresAt: string
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [batch, setBatch] = useState<Batch | null>(null)
  const [requestNumber, setRequestNumber] = useState(0)
  const [remaining, setRemaining] = useState('30:00')
  const [countdownLevel, setCountdownLevel] = useState<CountdownLevel>('quiet')
  const [expired, setExpired] = useState(false)
  const [announcement, setAnnouncement] = useState('')
  const expiryHandledRef = useRef(false)
  const countdownLevelRef = useRef<CountdownLevel>('quiet')
  const logRef = useRef<HTMLDivElement>(null)
  const proposalsRegionRef = useRef<HTMLElement>(null)

  const loadBatch = useCallback(
    async (batchId: string) => {
      const response = await fetch(`/api/courses/${courseId}/batches/${batchId}`, { cache: 'no-store' })
      if (!response.ok) return
      const payload = await response.json()
      setBatch({ batchId: payload.batchId, requestText: payload.requestText, proposals: payload.proposals })
    },
    [courseId],
  )

  // Deep-links the current batch into the URL (?batch=id) so a refresh
  // reloads the same review instead of losing it — a refresh shouldn't be
  // any more destructive to an in-progress review than the accepted
  // workspace-expiry risk already is.
  useEffect(() => {
    const batchId = searchParams.get('batch')
    if (batchId) loadBatch(batchId)
    // Only run once on mount — subsequent batch changes are driven by
    // actions in this component, not by re-reading the URL.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const deadline = Date.parse(expiresAt)

    function expireWorkspace() {
      if (expiryHandledRef.current) return
      expiryHandledRef.current = true
      setExpired(true)
      router.replace('/')
      router.refresh()
    }

    function updateRemaining() {
      const remainingMs = Math.max(0, deadline - Date.now())
      const minutes = Math.floor(remainingMs / 60_000)
      const seconds = Math.floor((remainingMs % 60_000) / 1000)
      setRemaining(`${minutes}:${String(seconds).padStart(2, '0')}`)
      const nextLevel = remainingMs <= 60_000 ? 'critical' : remainingMs <= 5 * 60_000 ? 'warning' : 'quiet'
      setCountdownLevel(nextLevel)
      if (nextLevel !== countdownLevelRef.current) {
        countdownLevelRef.current = nextLevel
        if (nextLevel === 'critical') {
          setAnnouncement('Workspace is about to expire — any unreviewed proposals will be lost.')
        } else if (nextLevel === 'warning') {
          setAnnouncement('Workspace expires in under 5 minutes.')
        }
      }
      if (remainingMs === 0) expireWorkspace()
    }

    updateRemaining()
    const interval = window.setInterval(updateRemaining, 1000)
    const timeout = window.setTimeout(expireWorkspace, Math.max(0, deadline - Date.now()))
    return () => {
      window.clearInterval(interval)
      window.clearTimeout(timeout)
    }
  }, [expiresAt, router])

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight })
  }, [messages])

  async function submitRequest(event: React.FormEvent) {
    event.preventDefault()
    const requestText = input.trim()
    if (!requestText || sending) return

    setMessages((previous) => [...previous, { role: 'user', text: requestText }])
    setInput('')
    setSending(true)
    setRequestNumber((previous) => previous + 1)

    try {
      const response = await fetch(`/api/courses/${courseId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({ requestText }),
      })
      const payload = await response.json()

      if (!response.ok) {
        setMessages((previous) => [
          ...previous,
          { role: 'error', text: payload?.error?.message ?? 'Something went wrong. Try again.' },
        ])
        return
      }

      if (payload.status === 'clarification') {
        setMessages((previous) => [...previous, { role: 'agent', text: payload.question }])
        return
      }

      if (payload.status === 'too-broad') {
        setMessages((previous) => [
          ...previous,
          {
            role: 'agent',
            text: `This touches more than ${payload.itemCap} items (found ${payload.matchCount}) — try narrowing your request to specific pages, quizzes, or a module.`,
          },
        ])
        return
      }

      setBatch({ batchId: payload.batchId, requestText, proposals: payload.proposals })
      router.replace(`/courses/${courseId}/review?batch=${payload.batchId}`, { scroll: false })
      const droppedNote =
        payload.droppedCount > 0
          ? ` (${payload.droppedCount} proposed change${payload.droppedCount === 1 ? '' : 's'} couldn't be safely applied and ${payload.droppedCount === 1 ? 'was' : 'were'} skipped.)`
          : ''
      setMessages((previous) => [
        ...previous,
        {
          role: 'agent',
          text: `Proposed ${payload.proposals.length} change${payload.proposals.length === 1 ? '' : 's'} for review.${droppedNote}`,
        },
      ])
    } catch {
      setMessages((previous) => [
        ...previous,
        { role: 'error', text: 'Could not reach the server. Check your connection and try again.' },
      ])
    } finally {
      setSending(false)
    }
  }

  function focusProposalsRegion() {
    proposalsRegionRef.current?.focus()
  }

  async function acceptOne(proposalId: string, itemTitle: string, isSensitive: boolean) {
    if (!batch) return
    const response = await fetch(`/api/courses/${courseId}/batches/${batch.batchId}/proposals/${proposalId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
      body: JSON.stringify({ action: 'accept', confirmed: isSensitive ? true : undefined }),
    })
    await loadBatch(batch.batchId)
    setAnnouncement(response.ok ? `Accepted: ${itemTitle}` : `Could not accept ${itemTitle}. Try again.`)
    focusProposalsRegion()
  }

  async function rejectOne(proposalId: string, itemTitle: string) {
    if (!batch) return
    const response = await fetch(`/api/courses/${courseId}/batches/${batch.batchId}/proposals/${proposalId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
      body: JSON.stringify({ action: 'reject' }),
    })
    await loadBatch(batch.batchId)
    setAnnouncement(response.ok ? `Rejected: ${itemTitle}` : `Could not reject ${itemTitle}. Try again.`)
    focusProposalsRegion()
  }

  async function acceptAllSafe() {
    if (!batch) return
    const count = safeToAccept.length
    await fetch(`/api/courses/${courseId}/batches/${batch.batchId}/accept-all`, {
      method: 'POST',
      cache: 'no-store',
    })
    await loadBatch(batch.batchId)
    setAnnouncement(`Accepted ${count} non-sensitive proposal${count === 1 ? '' : 's'}.`)
    focusProposalsRegion()
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

  const pending = batch?.proposals.filter((proposal) => proposal.status === 'proposed') ?? []
  const needsReview = pending.filter((proposal) => proposal.isSensitive)
  const safeToAccept = pending.filter((proposal) => !proposal.isSensitive)

  return (
    <main className="min-h-screen px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
      <div aria-live="polite" className="sr-only">
        {announcement}
      </div>
      <div className="mx-auto max-w-[1540px]">
        {countdownLevel === 'critical' ? (
          <div
            role="alert"
            className="mb-4 rounded-2xl border border-amber-300 bg-amber-100 px-5 py-3 text-sm font-semibold text-amber-950"
          >
            Workspace is about to expire — any unreviewed proposals will be lost. Finish reviewing now.
          </div>
        ) : null}

        <header className="mb-4 rounded-3xl border border-slate-200 bg-white px-5 py-5 shadow-panel sm:px-7 sm:py-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="eyebrow">Agent chat · Request {requestNumber || '—'}</p>
              <h1 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-ink sm:text-3xl">
                {courseName}
              </h1>
              {batch ? (
                <p className="mt-1 text-sm text-slate-600">
                  {pending.length} pending · {needsReview.length} need your review ·{' '}
                  {(batch.proposals.length - pending.length)} decided
                </p>
              ) : null}
            </div>
            <p
              className={`text-sm font-medium ${countdownLevel === 'warning' ? 'text-amber-700' : 'text-slate-600'}`}
            >
              Temporary workspace ·{' '}
              <span role="timer" aria-label={`Workspace time remaining ${remaining}`} className="font-semibold tabular-nums text-ink">
                {remaining}
              </span>{' '}
              remaining
            </p>
          </div>
        </header>

        <div className="grid min-h-[calc(100vh-11rem)] gap-4 lg:grid-cols-[26rem_minmax(0,1fr)]">
          <section
            aria-label="Chat with the agent"
            className="flex min-h-0 flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-panel"
          >
            <div className="border-b border-slate-200 px-5 py-5">
              <p className="eyebrow">Tell the agent what to change</p>
              <h2 className="mt-2 text-lg font-semibold text-ink">Chat</h2>
            </div>

            <div ref={logRef} aria-live="polite" className="flex-1 space-y-3 overflow-y-auto px-5 py-5">
              {messages.length === 0 ? (
                <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
                  Describe a change, e.g. &ldquo;extend the late-work deadline from 48 to 72 hours&rdquo;.
                </p>
              ) : (
                messages.map((message, index) => <ChatBubble key={index} message={message} />)
              )}
              {sending ? (
                <p role="status" className="text-sm font-medium text-slate-500">
                  Thinking…
                </p>
              ) : null}
            </div>

            <form onSubmit={submitRequest} className="border-t border-slate-200 p-4">
              <label htmlFor="chat-input" className="sr-only">
                Describe the change you want
              </label>
              <textarea
                id="chat-input"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault()
                    submitRequest(event)
                  }
                }}
                disabled={sending}
                rows={3}
                placeholder="Describe what you'd like changed…"
                className="w-full resize-none rounded-xl border border-slate-300 px-3 py-2 text-sm focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ocean"
              />
              <button
                type="submit"
                disabled={sending || !input.trim()}
                className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-white transition hover:bg-ocean focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ocean disabled:cursor-not-allowed disabled:opacity-50"
              >
                {sending ? 'Sending…' : 'Send'}
              </button>
            </form>
          </section>

          <section
            ref={proposalsRegionRef}
            tabIndex={-1}
            aria-label="Proposed changes"
            className="min-w-0 space-y-4 overflow-y-auto outline-none"
          >
            {!batch ? (
              <div className="flex min-h-96 items-center justify-center rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-panel">
                <div>
                  <p className="text-lg font-semibold text-ink">No proposals yet</p>
                  <p className="mt-2 text-sm text-slate-600">
                    Send a request in the chat to get proposed changes here.
                  </p>
                </div>
              </div>
            ) : (
              <>
                {needsReview.length > 0 ? (
                  <div>
                    <h3 className="mb-2 text-sm font-semibold uppercase tracking-[0.1em] text-amber-800">
                      Needs your review
                    </h3>
                    <div className="space-y-4">
                      {needsReview.map((proposal) => (
                        <ProposalCard
                          key={proposal.id}
                          proposal={proposal}
                          onAccept={() => acceptOne(proposal.id, proposal.itemTitle, proposal.isSensitive)}
                          onReject={() => rejectOne(proposal.id, proposal.itemTitle)}
                        />
                      ))}
                    </div>
                  </div>
                ) : null}

                {safeToAccept.length > 0 ? (
                  <div>
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <h3 className="text-sm font-semibold uppercase tracking-[0.1em] text-slate-500">
                        Safe to batch-accept
                      </h3>
                      <button
                        type="button"
                        onClick={acceptAllSafe}
                        className="inline-flex min-h-11 items-center rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ocean"
                      >
                        Accept {safeToAccept.length} non-sensitive proposal{safeToAccept.length === 1 ? '' : 's'}
                      </button>
                    </div>
                    <div className="space-y-4">
                      {safeToAccept.map((proposal) => (
                        <ProposalCard
                          key={proposal.id}
                          proposal={proposal}
                          onAccept={() => acceptOne(proposal.id, proposal.itemTitle, proposal.isSensitive)}
                          onReject={() => rejectOne(proposal.id, proposal.itemTitle)}
                        />
                      ))}
                    </div>
                  </div>
                ) : null}

                {pending.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
                    All proposals from this batch have been reviewed.
                  </div>
                ) : null}
              </>
            )}
          </section>
        </div>
      </div>
    </main>
  )
}

function ChatBubble({ message }: { message: ChatMessage }) {
  if (message.role === 'user') {
    return (
      <p className="ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-ink px-4 py-2 text-sm text-white">
        {message.text}
      </p>
    )
  }
  if (message.role === 'error') {
    return (
      <p role="alert" className="max-w-[85%] rounded-2xl rounded-bl-sm border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-900">
        {message.text}
      </p>
    )
  }
  return (
    <p className="max-w-[85%] rounded-2xl rounded-bl-sm border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-800">
      {message.text}
    </p>
  )
}
