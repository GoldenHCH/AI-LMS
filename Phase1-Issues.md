# Phase 1 (MVP) — GitHub Issues

Broken out from PRD P0-1…P0-7. Flow: **import → agent edit with reviewable diffs → export**, Canvas pages & quizzes only.

**Labels used:** `phase-1` `backend` `frontend` `agent` `canvas-integration` `infra` `spike`
**Size:** S (≤2d) · M (3–5d) · L (1–2wk)
**Suggested milestone:** `MVP`

---

## #1 — Spike: New-course export fidelity via Common Cartridge
**Labels:** `spike` `canvas-integration` `phase-1` · **Size:** S · **Blocks:** #9, #10

**Status:** REFRAMED. The export model changed from *in-place write-back* to *creating a new
Canvas course*. The prior July 14, 2026 BYU probe proved in-place quiz write-back is NO-GO —
stem/option edits silently failed in the Canvas UI (see `backend/spikes/quiz_writeback/FINDINGS.md`).
That path is retired. The new question is whether we can reproduce our imported pages + quizzes
in a **fresh** Canvas course by generating a Common Cartridge (`.imscc`) the professor uploads.

**Why:** Export now means *materializing a new course*, not mutating the live one. Common
Cartridge sidesteps course-creation API permissions (which instructor PATs usually lack) and uses
no write API against the live course — Canvas's own importer builds the content. The open risk is
fidelity: how faithfully Canvas's `.imscc` importer reconstructs our pages and quizzes.

**Acceptance criteria**
- [ ] Generate a valid Common Cartridge (`.imscc`) from the internal model (#3) containing modules, pages, and quizzes.
- [ ] Upload it to a test Canvas course (Import Course Content → Common Cartridge) and verify a new course is created with no changes to any source course.
- [ ] Confirm page bodies survive the round trip (structure, formatting, links, images).
- [ ] Confirm quiz questions, options, correct answers, and point values survive; document how New Quizzes are handled (Canvas tends to import them as Classic).
- [ ] Document any item types or fields Common Cartridge cannot represent (constraints feed into #8 guardrails and #9 export preview).
- [ ] Written findings + go/no-go on the `.imscc` export path in the issue thread.

---

## #2 — Canvas connect + course import (P0-1)
**Labels:** `frontend` `backend` `canvas-integration` `phase-1` · **Size:** L · **Depends on:** #3

**User story:** As an instructor, I want to connect my Canvas course with my own credentials and import it, so that the tool has my real content to work with — without needing an LMS admin.

**MVP auth path — manual base URL + personal access token (PAT).** For MVP we use a manual credential form, not OAuth. The instructor generates a personal access token in Canvas (Account → Settings → New Access Token) and pastes it with their Canvas base URL. This needs no developer-key registration or admin approval, and maps to the existing `CanvasAdapter.from_access_token(...)` path (`backend/canvas_import/canvas/adapter.py`). OAuth is deferred — see #2b.

**Acceptance criteria**
- [x] A connect form accepts a **Canvas base URL** (e.g. `https://school.instructure.com`) and a **personal access token**; the token field is masked (password input).
- [x] The token is validated against Canvas before import (e.g. `GET /users/self`); an invalid token or unreachable/malformed URL shows a clear, specific error and no course row is created.
- [x] On valid credentials, the instructor sees their Canvas course list and selects exactly one course to import.
- [x] Import pulls modules, pages, and quizzes into the internal model (#3) and persists them to the Supabase scratchpad via `SupabaseCourseWriter`, then lands the instructor on the course tree view (#4).
- [x] Files (PPTX/PDF) are listed as read-only context, not imported as editable.
- [x] Import is non-destructive — the source Canvas course is unmodified (GET-only; already enforced by the adapter and its round-trip test).
- [x] New Quizzes import but are surfaced read-only in the editor until export fidelity is confirmed (gated on #1).
- [x] Clear error/empty states for auth failure, no courses, and partial import (`PartialImportError` — failed items preserved as `opaque`, never silently dropped).

**Token handling (non-negotiable)**
- [x] The Canvas URL and access token exist only in transient form state and request-local server memory during connect/import. Neither is written to environment files, browser storage, cookies, URLs, the database, logs, error messages, or analytics.
- [x] A successful import creates an opaque, signed-cookie workspace that is isolated from every other visitor, becomes inaccessible exactly 30 minutes after import, and is cascade-deleted by the next one-minute Cron run.
- [x] The token is never placed in a URL or query string; it travels in a request body over HTTPS.
- [x] Consult the `eduquest-compliance` guardrails when implementing credential handling.

---

## #2b — Canvas OAuth (deferred, post-MVP)
**Labels:** `backend` `canvas-integration` · **Size:** L · **Depends on:** #2

**User story:** As an instructor, I want to connect via Canvas OAuth (one-click, no manual token) so that connecting is easier and tokens refresh automatically.

**Acceptance criteria**
- [ ] Instructor completes Canvas OAuth as an individual (no LMS admin required) and grants course read/write scope.
- [ ] Refresh-token lifecycle handled; import reuses the same course-selection + import flow as #2.
- [ ] Reuses `CanvasOAuthClient` (`backend/canvas_import/canvas/oauth.py`).

Note: OAuth needs a registered Canvas developer key, which many institutions gate behind an admin — that is why manual PAT is the MVP path.

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

**User story:** As an instructor, I want changes to quiz answers/points/question-count explicitly flagged so that I trust the answer keys in the course I export.

**Note:** Export now lands in a **new, student-less course**, so a silent grading change to a
live gradebook is impossible by construction. These guardrails are therefore a *review-trust*
mechanism (surface every answer-key change clearly), not a live-grading safety gate.

**Acceptance criteria**
- [ ] Any change to a correct answer, point value, or question count is visually flagged in the diff.
- [ ] The pre-export preview (#9) summarizes all answer/point/count changes so the instructor confirms them before generating the cartridge.
- [ ] Confirmation is per-change (or per-quiz), not a single blanket "yes."

---

## #9 — Export as a new Canvas course, with preview + confirm (P0-6)
**Labels:** `backend` `canvas-integration` `phase-1` · **Size:** L · **Depends on:** #3, #7, #1

**User story:** As an instructor, I want to export my edited course as a **new** Canvas course, with a preview and confirmation, so that I get a clean copy of my changes without any risk to the live course my students are using.

**Details:** Export produces a Common Cartridge (`.imscc`) built from the accepted working copy
(#7). The instructor uploads it to Canvas (Import Course Content → Common Cartridge), which
creates a fresh course. We never call a write API against the source course.

**Acceptance criteria**
- [ ] The working copy (pages + quizzes, with accepted edits) serializes to a valid Common Cartridge.
- [ ] Quiz structure (questions, correct answers, points) is represented per #1 findings.
- [ ] Instructor sees a pre-export preview of exactly what the new course will contain (and, from #8, a summary of answer/point/count changes), and must confirm before the cartridge is generated.
- [ ] The source Canvas course is provably never modified by export.
- [ ] Export failures are surfaced clearly (invalid cartridge, unrepresentable items reported); no partial silent corruption.
- [ ] Clear handoff instructions for uploading the `.imscc` into Canvas.

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
1. **#1** (spike) — unblocks export scope (import is already read-only and working)
2. **#2 + #3** — import + model (parallel-ish once #1 lands)
3. **#4** — course view
4. **#5 → #6 → #7** — agent → diffs → accept/reject (sequential)
5. **#8** — quiz guardrails (after diffs exist)
6. **#9** — export (needs model + accepted changes + spike findings)
7. **#10** — beta harness last

## Explicitly NOT in Phase 1
Cross-item propagation (P1-1), proposed-update entry point (P1-2), staging-course export (P1-3), changelog (P1-4), rollback (P1-5), file editing, analytics. Park these; don't let them creep into MVP issues.
