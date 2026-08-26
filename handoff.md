# Handoff — Agent Chat / Batch Diff Review (#5-7)

**Branch:** `Golden` · **State:** everything below is uncommitted working-tree changes. Nothing has been committed or pushed this session.

## What shipped

Build order items #5-7 from `CLAUDE.md` — agent chat → server-computed diffs → accept/reject/refine review UI — are implemented and tested end-to-end, on top of the already-shipped #1-4 (Canvas import, course model, tree view).

The flow: a professor types a request in a chat panel → the request is pre-filtered against the course tree (word-boundary keyword match, capped at 20 items) → Claude proposes page/quiz edits via a forced tool call → the server recomputes a diff from stored state (never trusts the model's own description) → proposals persist as a `change_batch` + `change_proposals` rows → the review UI shows before/after diffs, flags anything touching a correct answer/points/question-count as sensitive (requiring an explicit confirm checkbox), and supports accept-one / reject-one / accept-all-non-sensitive.

## Verification performed

- `npm run typecheck`, `npm run build`, `npm run test:web` (49 tests), `python -m pytest -q` (57 passed, 2 skipped) all green as of the last commit-ready state. **Use the conda `python` (`/opt/anaconda3/bin/python`), not `.venv/bin/python`** — the venv is missing the `canvas_import` package and pytest collection fails there.
- Live browser QA against seeded Supabase test data (all cleaned up after — nothing left in the DB): accept, reject, multi-item accept-all, zero-match clarification, too-broad clarification, agent-unreachable error path, cross-workspace isolation (both directions), expired-cookie rejection, countdown warning/critical visual states, keyboard tab-order and disabled-state gating.
- A 47-agent adversarial code review (5 dimensions: security/isolation, data-integrity, quiz-safety, agent-contract robustness, accessibility) surfaced 14 findings that survived independent refutation. 12 were fixed this session (see below); 2 were deliberately deferred.

## Bugs found and fixed this session

| Area | Fix |
|---|---|
| `app/api/courses/[courseId]/batches/[batchId]/route.ts` | Removed the same-origin CSRF check from this read-only GET route — browsers don't reliably send `Origin` on same-origin GETs, so it was 403ing legitimate requests. State-changing routes keep the check. |
| `supabase/migrations/20260723150000_...sql` | Revoked the `PUBLIC` execute grant Postgres adds by default on function creation — the original migration only revoked `anon`/`authenticated` directly, leaving `PUBLIC` (which those roles inherit from) untouched. Not currently exploitable (table-level grants already block it), but closed as defense-in-depth. |
| `app/api/.../proposals/[proposalId]/route.ts` + `lib/changes/changeBatch.ts` | **Critical:** the sensitive-quiz confirm checkbox was client-state only — the accept endpoint never checked it server-side. A devtools call, second tab, or disabled-attribute removal could accept a grading change with zero confirmation. Now the PATCH route requires `confirmed: true` in the body for any `is_sensitive` proposal and rejects with 400 `confirmation_required` otherwise. |
| `lib/changes/diff.ts` | Answer `weight` changes weren't flagged sensitive (unlike `isCorrect`/`pointsPossible`) — partial-credit redistribution could slip into non-sensitive batch-accept. |
| `lib/changes/diff.ts` (`normalizeHtml`) | Whitespace inside `<pre>`/`<textarea>` was being collapsed, so re-indented code blocks registered as "no change." Now whitespace-significant elements are preserved verbatim. |
| `lib/changes/diff.ts` (`normalizeNode`) | Purely cosmetic reformatting (indentation between block tags) was flagged as a real diff. Whitespace-only text nodes are now dropped instead of collapsed to a stray space. |
| `lib/agent/proposal.ts` | A single malformed proposal from the model failed parsing of the *entire* batch. Now each item is parsed independently; malformed ones are dropped and counted into the same `droppedCount` the chat route already reports. |
| `lib/agent/proposal.ts` | `isCorrect`/`weight`/`pointsPossible` used `.optional()` (undefined-only), but the DTO shown to the model types these as `T \| null` — a model echoing an explicit `null` back failed validation. Now `.nullish()` + a transform folds `null` back to `undefined` so "field not touched" semantics still hold. |
| `app/courses/[courseId]/review/ReviewWorkbench.tsx` | Accept/reject removed the whole card with no focus management or outcome announcement. Added an `aria-live="polite"` sr-only announcer (accept/reject outcomes, accept-all counts, countdown warning/critical transitions) and focus now moves to the proposals region after a decision. Chat log container is now `aria-live="polite"` too. |
| `app/courses/[courseId]/review/ReviewWorkbench.tsx` | The critical-tier countdown alert re-rendered every second inside `role="alert"`, causing ~60 repeated assertive screen-reader interruptions. Alert text is now static; the ticking number stays in the header's `role="timer"` only. |
| `app/courses/[courseId]/review/ProposalCard.tsx` | Sensitive-confirm checkbox was ~16px, under the 44px minimum `CLAUDE.md` requires for destructive-action UI. Now 44px. |
| `app/courses/[courseId]/review/ProposalCard.tsx` | Accept/Reject buttons had no per-proposal accessible name (indistinguishable in a screen reader's buttons list). Added `aria-label` with the item title. |

New tests added covering all of the above: `tests/web/diff.test.ts` (whitespace/`<pre>`/weight-sensitivity), `tests/web/agentResponseSchema.test.ts` (partial-batch tolerance, null-field tolerance).

## Deliberately deferred (not fixed)

Both are real, both are lower-risk to leave than to rush:

1. **`accept_change_proposals` RPC doesn't verify row-counts.** If two proposals race to touch the same quiz question (one deletes it, another edits it), the second silently no-ops but still reports `accepted: true`. Requires `GET DIAGNOSTICS` checks added to the plpgsql function — a higher-risk change to the transactional core I didn't want to make under time pressure. See `TODOS.md` → "Baseline version check to prevent stale-batch overwrites" for the closely-related existing entry; this is a sibling gap in the same function.
2. **Answer-text edits on short-answer/matching quiz questions aren't flagged sensitive.** For these question types the answer text *is* the correctness definition (unlike multiple-choice, where `isCorrect` carries that meaning) — editing it changes what Canvas auto-grades as correct, but nothing in `computeProposalDiff` reads `questionType`. Needs Canvas question-type-aware logic; see `TODOS.md` → "Widen quiz-safety predicate beyond isCorrect" for the pre-existing, closely-related open item.

I added both as new entries in `TODOS.md` this session — see the bottom of that file.

## Files touched (uncommitted)

Everything under `?? ` in `git status` plus the modified files listed there is this session's + prior #1-4 work. Notably:
- `lib/agent/` — proposal schema, prefilter, DTO, Anthropic client
- `lib/changes/` — diff engine, persistence (`changeBatch.ts`), review projection
- `app/api/courses/[courseId]/{chat,batches}/` — the four API routes
- `app/courses/[courseId]/review/` — the review UI
- `supabase/migrations/2026072301*` through `2026072315*` — three new migrations (batches/proposals schema, accept RPC, PUBLIC-grant revoke)
- `tests/web/{diff,agentClient,agentResponseSchema,dto,prefilter}.test.ts` — new test files

## Gotchas for next session

- **Don't `rm -rf .next` while the dev server is running against it** — Turbopack's persistent dev cache gets corrupted (`TurbopackInternalError: Failed to restore task data`) and every route 500s until you stop the server, clear `.next`, and restart. Safe to clear `.next` only when the dev server is stopped (or before first start).
- Stray `.next/types/* 2.ts` files are a recurring macOS-sync-conflict artifact, not a real error — `rm -rf .next` (server stopped) and rebuild if `tsc` reports `TS6200`/`TS2300` duplicate-identifier errors there.
- No `ANTHROPIC_API_KEY` is configured locally — the chat's real-LLM path is untested against the live API this session; only the fake-client unit tests and the graceful "agent could not be reached" UI path were verified.
- Browser-based QA in this environment needs a real signed `ai_lms_workspace` cookie (HttpOnly, can't be set via page JS). The pattern used this session: a standalone Node `http` server on a different port (cookies are host-scoped, not port-scoped) that 302-redirects with a real `Set-Cookie` header carrying a token minted via the same HMAC algorithm as `lib/workspaces/sessionToken.ts`. Not part of the repo — recreate ad hoc if needed, don't add a dev-only cookie-minting endpoint to the app itself.

## Suggested next steps

1. Review the diff, then commit (`#5-7 complete` is a reasonable single commit, or split by lane if preferred).
2. Per `CLAUDE.md` build order, `#8` (quiz-safety guardrails) is largely already folded into #5-7's sensitivity flagging — the two deferred items above are what's left of that scope.
3. `#9` (export with preview + confirm) is next up and currently unstarted.
4. Before real school data flows: the applicable DPA/sub-processor review (per `CLAUDE.md`'s compliance boundary) is still outstanding and unrelated to code.
