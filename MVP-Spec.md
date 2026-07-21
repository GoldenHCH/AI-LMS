# PRD: AI-Native Course Editor for Canvas — MVP

**Status:** Draft for review
**Author:** Golden
**Last updated:** July 16, 2026
**One-liner:** Cursor for Canvas courses — a professor imports a course, tells an agent how to change it, reviews the proposed edits, and exports the result as a new Canvas course.

---

## Problem Statement

Conscientious professors update their courses every semester based on student feedback, their own teaching intuition, and new research — but *executing* those updates is brutally tedious. A single intended change ("make the week-5 material harder," "cut the outdated framework, add the new one") ripples across many artifacts — pages, quizzes, and the way concepts are framed — and the professor has to hold all of that context in their head and hand-edit each piece in Canvas. The deciding is not the bottleneck; the mechanical, consistent propagation of decisions across a course is. Today that work is slow enough that most course content quietly rots.

## Background & Key Decisions (from discovery)

- **The professor supplies the intent.** Professors have strong intuition about what needs to change. The MVP does *not* try to tell them what to fix. It executes changes they've already decided on.
- **Value = execution speed + consistency, not insight.** This is the whole bet for v1. The product wins only if reviewing the agent's edits is *dramatically* faster than making them by hand.
- **Analytics is V2.** Tracking student interactions ("PostHog for courses") to *generate* the change signal is explicitly deferred. It becomes the reason-for-each-change layer later; it is not in the MVP.
- **Canvas structure = location, not dependency.** We mirror Canvas's model (modules → items: pages, quizzes, files), but Canvas stores containment, not the semantic links between a slide, a reading, and the exam question that tests it. Real cross-artifact propagation requires inferring those links — see Open Questions.
- **Canvas-native content first.** Pages and quizzes are structured and API-editable. Files (PPTX/PDF) are opaque blobs and far harder to edit and write back. MVP handles pages and quizzes; files are out of scope.
- **Export creates a new course, not an in-place write-back.** The edited course is exported as a Common Cartridge (`.imscc`) the professor uploads into Canvas as a fresh course. This was chosen deliberately: (a) an early spike proved in-place quiz write-back is unreliable — question stem/option edits silently failed in the Canvas UI; (b) creating a course via the Canvas API needs permissions instructors' personal tokens usually lack, while a cartridge upload needs none; (c) it makes damaging the live course structurally impossible. The tradeoff to validate: how faithfully Canvas's importer reconstructs quizzes (it tends to convert New Quizzes to Classic).

---

## Goals

1. **A professor can complete a real semester's worth of intended edits faster in-tool than by hand.** Target: at least 50% reduction in self-reported editing time for a representative update, in concierge/beta testing.
2. **Edits clear the professor's review bar with minimal rework.** Target: ≥70% of agent-proposed changes accepted with no or trivial edits.
3. **Round-trip integrity.** A course imported from Canvas, edited, and exported as a new course reproduces cleanly — no lost content, broken quizzes, or scrambled formatting. Target: zero data-loss incidents across beta courses.
4. **Prove the core bet with real professors.** Get ≥3 professors to run a genuine next-semester update end-to-end and say they'd use it again.

## Non-Goals (v1)

- **Deciding *what* to change.** No recommendation engine, no "here's what students struggled with." The professor drives.
- **Student interaction analytics.** No tracking, dashboards, dropoff/heatmap signals. (V2.)
- **Editing uploaded files (PPTX, PDF, video).** Opaque-blob editing is a separate, much larger problem. (Future.)
- **Automatic dependency-graph inference across artifacts.** v1 propagates within what the agent can see in-context; it does not claim guaranteed course-wide semantic propagation. (P1/Future — see Open Questions.)
- **Multi-professor collaboration, version branching, LMS other than Canvas.** Not now.
- **Publishing/grading workflows, student-facing anything.** Out of scope.

---

## Target Users

- **Primary:** Individual instructors who own their course content in Canvas and actively revise it each term (the conscientious-updater segment). Bottom-up adoption, one course at a time.
- **Secondary (later):** Departments / instructional designers managing many courses. Not a v1 focus.

---

## User Stories

**Import**
- As an instructor, I want to connect my Canvas account and import a specific course so that the tool has my real content to work with.
- As an instructor, I want to see my imported course laid out as modules and items (pages, quizzes) so that it's recognizable and I can trust nothing was dropped.

**Edit via agent**
- As an instructor, I want to describe a change in plain language ("tighten the week-5 page and add a question on X to that quiz") so that I don't have to hand-edit each item.
- As an instructor, I want the agent to propose a concrete set of edits as a reviewable diff so that I can see exactly what will change before anything is committed.
- As an instructor, I want to accept, reject, or refine individual proposed edits via chat so that I stay in control and the final content is mine.
- As an instructor, I want each proposed change to include a short rationale so that reviewing is fast and I understand why the agent did what it did.

**Export**
- As an instructor, I want to export the edited course as a new Canvas course so that I get a clean copy of my changes without touching the live course my students use.
- As an instructor, I want to preview exactly what the new course will contain and confirm before it's generated so that I trust the result.

**Edge / trust**
- As an instructor, I want a clear warning when a change touches a quiz's correct answers or point values so that I trust the answer keys in the course I export.
- As an instructor, I want to see which items were *not* touched so that I can confirm the scope of what changed.

---

## Requirements

### Must-Have (P0)

**P0-1 — Canvas import**
Connect to Canvas with a manually entered URL and personal access token and import a selected course's modules, pages, and quizzes into an internal structured representation (modules → items).
- Given a connected Canvas account, when the instructor selects a course, then its modules, pages, and quizzes are imported and displayed in a module/item tree.
- Files (PPTX/PDF) are listed as read-only context but not editable.
- Import is non-destructive; the source Canvas course is untouched on import.
- Every visit begins with blank credential fields. The Canvas URL and token are never stored in environment files, cookies, browser storage, URLs, logs, or the database.
- A successful import creates an isolated 30-minute workspace. Its deadline is fixed, access requires the matching signed secure cookie, and expiration or disconnect deletes the working copy.

**P0-2 — Structured internal course model**
Represent the course as editable objects (page = rich text/HTML; quiz = questions, options, correct answers, points) — the "codebase" the agent operates on.
- Round-trips losslessly: import → export with no edits produces a new course reproducing the original content. The model is what serializes into the export cartridge (P0-6), so fidelity depends on it.

**P0-3 — Agent chat interface**
A chat/agent panel where the instructor issues natural-language edit instructions scoped to the course.
- The agent can read any imported item as context.
- The agent operates only within the imported course; it does not invent modules/items unless asked.

**P0-4 — Proposed edits as reviewable diff**
The agent returns changes as a diff (before/after) per affected item, not as silent in-place edits.
- Given an instruction, when the agent responds, then each affected page/quiz shows a clear before→after diff.
- Each proposed change includes a one-line rationale.
- Nothing is written to the working course until the instructor accepts.

**P0-5 — Accept / reject / refine**
The instructor can accept or reject each proposed change, or refine it by replying in chat.
- Accepted changes update the working copy; rejected ones are discarded; refinements produce a new diff.

**P0-6 — Export as a new Canvas course**
Serialize the edited pages and quizzes into a Common Cartridge (`.imscc`) the instructor uploads to Canvas (Import Course Content → Common Cartridge), which creates a fresh course.
- Given accepted changes, when the instructor exports, then a valid cartridge is produced and the resulting Canvas course reflects the edits.
- Quiz structure (questions, correct answers, points) is represented in the cartridge; document how New Quizzes are handled (Canvas tends to import them as Classic).
- Export is previewable — the instructor sees exactly what the new course will contain and confirms before the cartridge is generated.
- The source Canvas course is never modified; no write API is called against it. (No fresh credentials are needed to export — the cartridge is produced locally and the instructor uploads it.)

**P0-7 — Quiz-safety guardrails**
Any change to a quiz's correct answers, point values, or question count is explicitly flagged in the diff. Because the export lands in a new, student-less course, this is a review-trust flag, not a live-grading gate.
- The pre-export preview summarizes all answer/point/count changes, and the instructor confirms them before the cartridge is generated.

### Nice-to-Have (P1)

- **P1-1 — Cross-item propagation.** When editing a concept, surface *other* items that reference it and offer to update them together (a first, shallow step toward real dependency propagation).
- **P1-2 — "Proposed semester update" entry point.** Instead of a blank chat box, let the instructor paste their feedback notes / intended changes and have the agent open with a proposed set of edits to react to. (Addresses the blank-agent-box problem.)
- **P1-3 — ~~Export to a new/unpublished Canvas course as a safe staging target~~ — absorbed into P0-6.** New-course export *is* the MVP export model now, so this is no longer a fast-follow. A remaining P1 refinement: let the instructor choose to import the cartridge into an existing empty shell / specific sub-account rather than a brand-new course.
- **P1-4 — Change summary / changelog** the instructor can export (what changed this semester and why).
- **P1-5 — ~~Undo/rollback of a completed export~~ — largely obviated by P0-6.** Since export creates a new course and never mutates the source, "rollback" is just discarding the new course. A P1 nicety: re-export or regenerate the cartridge after further edits.

### Future Considerations (P2)

- **P2-1 — File (PPTX/PDF) editing** with write-back.
- **P2-2 — Student interaction analytics** as the change-signal layer (the V2 "PostHog for courses"), feeding rationale into proposed edits.
- **P2-3 — Automatic semantic dependency graph** across all artifacts (slide ↔ reading ↔ exam) for guaranteed course-wide propagation.
- **P2-4 — Multi-course / department workflows, other LMSs.**

> **Architectural note:** Build the internal course model (P0-2) so that item-to-item semantic links *can* be attached later without a rewrite — P2-3 depends on it. Keep the import layer LMS-agnostic enough that non-Canvas sources are possible, even though we only build Canvas now.

---

## Success Metrics

**Leading (days–weeks)**
- Editing-time reduction vs. manual, self-reported: target ≥50%.
- Proposed-edit acceptance rate: target ≥70% accepted with no/trivial change.
- Round-trip integrity: 0 data-loss or broken-quiz incidents.
- Activation: % of imported courses that reach a completed export (target: most beta courses complete at least one).

**Lagging (weeks–months)**
- Repeat use: professors who run a *second* update in a later term.
- Willingness to pay / recommend among beta professors.
- Coverage: % of a professor's intended changes that "pages and quizzes only" could actually satisfy (validates the scope cut).

---

## Open Questions

- **[Stakeholder/Research — blocking] Is editing actually the bottleneck worth paying for?** The entire value rests on this. Validate via concierge (below) before heavy build.
- **[Research — blocking] Does "pages and quizzes only" cover enough of what professors actually change?** If most content lives in PPTX/PDF, the MVP scope may be too thin. Measure on real courses.
- **[Engineering] Common Cartridge export fidelity** — how faithfully does Canvas's `.imscc` importer reconstruct our pages and quizzes in a new course, and how does it handle New Quizzes (likely converting them to Classic)? Confirm early; this constrains P0-6/P0-7. (Supersedes the earlier in-place quiz write-back question, which the spike proved unreliable.)
- **[Engineering] Future OAuth / institutional permissions** — the MVP uses a request-local PAT for *import*; *export* needs no API permissions because the instructor uploads the cartridge themselves. Before adding OAuth or a one-click course-creation API path, confirm whether an individual instructor can authorize it without an LMS admin and how procurement/IT affects bottom-up adoption.
- **[Design] Blank agent box vs. proposed-update entry point** — do professors get value typing into an empty agent, or do they need the P1-2 "here's a proposed set of changes, react to it" opener on day one?
- **[Engineering/Design] Diff representation for rich content** — how do we show a clean, trustworthy before→after for HTML pages and quiz questions so review is genuinely fast?

---

## Timeline / Phasing

- **Phase 0 — Concierge validation (before building):** Take one real professor's course + their real intended next-semester changes. Hand-produce the edited pages and quizzes. Answer the two blocking questions: does the output clear their review bar, and does pages-and-quizzes-only cover enough? Cheapest possible test of the core bet.
- **Phase 1 — MVP (P0-1…P0-7):** Import → agent edit with reviewable diffs → export as a new Canvas course (Common Cartridge), Canvas pages and quizzes, quiz-safety guardrails. Beta with ≥3 professors running genuine updates.
- **Phase 2 — P1 fast-follows:** Proposed-update entry point, shallow cross-item propagation, staging export, changelog, rollback.
- **Later — V2:** File editing and the analytics/change-signal layer.
