# Phase 1 (MVP) — GitHub Issues

Broken out from PRD P0-1…P0-7. Flow: **import → agent edit with reviewable diffs → export**, Canvas pages & quizzes only.

**Labels used:** `phase-1` `backend` `frontend` `agent` `canvas-integration` `infra` `spike`
**Size:** S (≤2d) · M (3–5d) · L (1–2wk)
**Suggested milestone:** `MVP`

---

## #1 — Spike: Canvas API write-back fidelity (quizzes)
**Labels:** `spike` `canvas-integration` `phase-1` · **Size:** S · **Blocks:** #2, #9, #10

**Status:** OPEN — the July 14, 2026 BYU Classic probe preserved unchanged/restored payloads but
failed stem/option write fidelity and Canvas UI verification. New Quizzes remain untested and
read-only. See `backend/spikes/quiz_writeback/FINDINGS.md`.

**Why:** The whole export path depends on cleanly reading *and writing* quiz questions, correct answers, and points. New Quizzes vs. Classic Quizzes have different APIs and limits. De-risk before building.

**Acceptance criteria**
- [x] Confirm which quiz type(s) we support in MVP (Classic, New, or both) and document API endpoints for read + write.
- [x] Prove round-trip on a test course: read a quiz → write it back unchanged → verify no data loss.
- [ ] Prove we can programmatically edit a question stem, an option, a correct answer, and point value, and see it in Canvas.
- [x] Document any fields we *cannot* reliably write (constraints feed into #10 guardrails).
- [ ] Written findings + go/no-go on scope in the issue thread.

---

## #2 — Canvas OAuth + course import (P0-1)
**Labels:** `backend` `canvas-integration` `phase-1` · **Size:** L · **Depends on:** #1

**User story:** As an instructor, I want to connect my Canvas account and import a specific course so that the tool has my real content to work with.

**Acceptance criteria**
- [ ] Instructor completes Canvas OAuth as an individual (no LMS admin required) and grants course read/write scope.
- [ ] Instructor selects one course from their course list to import.
- [ ] Import pulls modules, pages, and quizzes into the internal model (#3).
- [ ] Files (PPTX/PDF) are listed as read-only context, not imported as editable.
- [ ] Import is non-destructive — the source Canvas course is unmodified.
- [ ] Clear error/empty states for auth failure, no courses, or partial import.

---

## #3 — Internal course model + lossless round-trip (P0-2)
**Labels:** `backend` `phase-1` · **Size:** L · **Blocks:** #5, #9

**User story:** As an instructor, I want my imported course represented faithfully so that nothing is dropped or scrambled when I edit and export.

**Details:** Page = rich text/HTML. Quiz = questions, options, correct answers, points. Design so item-to-item semantic links can be attached later (P2-3) without a rewrite.

**Acceptance criteria**
- [ ] Data model for module, page, quiz, question defined and documented.
- [ ] Import → export with **no edits** reproduces the original course content (byte-meaningful equivalence for pages; structural equivalence for quizzes).
- [ ] Automated round-trip test on ≥2 real sample courses passes with zero data loss.
- [ ] Model has an extension point for future item-to-item links (no implementation yet).

---

## #4 — Course view: module/item tree (P0-1 UI)
**Labels:** `frontend` `phase-1` · **Size:** M · **Depends on:** #3

**User story:** As an instructor, I want to see my imported course as modules and items so that it's recognizable and I can trust nothing was dropped.

**Acceptance criteria**
- [ ] Modules → items (pages, quizzes) render in a navigable tree.
- [ ] Selecting an item shows its current content (page body; quiz questions/answers/points).
- [ ] Files appear as read-only, visually distinct from editable items.
- [ ] Item count and module count match the source Canvas course.

---

## #5 — Agent chat interface, course-scoped (P0-3)
**Labels:** `agent` `frontend` `backend` `phase-1` · **Size:** L · **Depends on:** #3

**User story:** As an instructor, I want to describe a change in plain language so that I don't have to hand-edit each item.

**Acceptance criteria**
- [ ] Chat panel accepts natural-language edit instructions scoped to the imported course.
- [ ] Agent can read any imported item as context.
- [ ] Agent operates only within the imported course; it does not invent modules/items unless explicitly asked.
- [ ] Agent asks a clarifying question when an instruction is ambiguous rather than guessing.
- [ ] Instructions and responses persist for the session.

---

## #6 — Agent produces edits as reviewable diffs (P0-4)
**Labels:** `agent` `frontend` `phase-1` · **Size:** L · **Depends on:** #5 · **Blocks:** #7

**User story:** As an instructor, I want proposed changes shown as before→after diffs with rationale so that I can review fast and trust what will change.

**Acceptance criteria**
- [ ] Agent returns changes as per-item diffs (before/after), never silent in-place edits.
- [ ] Each affected page shows a readable rich-text/HTML diff.
- [ ] Each affected quiz shows changed questions/options/answers/points clearly.
- [ ] Each proposed change includes a one-line rationale.
- [ ] Nothing is written to the working copy until accepted (#7).
- [ ] Items the agent did **not** touch are identifiable, so scope of change is clear.

---

## #7 — Accept / reject / refine changes (P0-5)
**Labels:** `frontend` `agent` `phase-1` · **Size:** M · **Depends on:** #6

**User story:** As an instructor, I want to accept, reject, or refine each proposed change so that the final content is mine.

**Acceptance criteria**
- [ ] Accept applies a change to the working copy.
- [ ] Reject discards it; working copy unchanged.
- [ ] Refine (reply in chat) produces a new diff for that item.
- [ ] Accept-all / reject-all available for a proposed batch.
- [ ] Working copy state is always distinct from the not-yet-exported Canvas course.

---

## #8 — Quiz-safety guardrails (P0-7)
**Labels:** `frontend` `backend` `phase-1` · **Size:** M · **Depends on:** #6, #1

**User story:** As an instructor, I want changes to quiz answers/points/question-count explicitly flagged so that I never silently ship a grading error.

**Acceptance criteria**
- [ ] Any change to a correct answer, point value, or question count is visually flagged in the diff.
- [ ] Export is blocked for a quiz-answer change until the instructor explicitly confirms it.
- [ ] Confirmation is per-change (or per-quiz), not a single blanket "yes."

---

## #9 — Export to Canvas with preview + confirm (P0-6)
**Labels:** `backend` `canvas-integration` `phase-1` · **Size:** L · **Depends on:** #3, #7, #1

**User story:** As an instructor, I want to export edits back to Canvas, with a preview and confirmation, so that changes reach my students without fear of breaking the live course.

**Acceptance criteria**
- [ ] Accepted changes to pages and quizzes write back to the Canvas course.
- [ ] Quiz structure (questions, correct answers, points) writes back correctly (per #1 findings).
- [ ] Instructor sees a pre-export preview of exactly what will change, and must confirm.
- [ ] Untouched items are not rewritten.
- [ ] Export failures are atomic-ish and surfaced clearly (no partial silent corruption); failed items reported.

---

## #10 — MVP beta harness: onboarding + feedback capture
**Labels:** `infra` `phase-1` · **Size:** S · **Depends on:** #9

**Why:** Phase 1 success = ≥3 professors run a genuine next-semester update end-to-end and would use it again. We need to actually measure that.

**Acceptance criteria**
- [ ] Simple onboarding for a beta instructor to connect Canvas and import a course.
- [ ] Capture the two validation metrics: self-reported editing-time reduction, and proposed-edit acceptance rate.
- [ ] Log round-trip integrity issues (data loss / broken quizzes) for zero-incident tracking.
- [ ] Lightweight way to collect qualitative "would you use again" feedback.

---

## Dependency order (suggested build sequence)
1. **#1** (spike) — unblocks import/export scope
2. **#2 + #3** — import + model (parallel-ish once #1 lands)
3. **#4** — course view
4. **#5 → #6 → #7** — agent → diffs → accept/reject (sequential)
5. **#8** — quiz guardrails (after diffs exist)
6. **#9** — export (needs model + accepted changes + spike findings)
7. **#10** — beta harness last

## Explicitly NOT in Phase 1
Cross-item propagation (P1-1), proposed-update entry point (P1-2), staging-course export (P1-3), changelog (P1-4), rollback (P1-5), file editing, analytics. Park these; don't let them creep into MVP issues.
