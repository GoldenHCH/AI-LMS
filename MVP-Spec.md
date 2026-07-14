# PRD: AI-Native Course Editor for Canvas — MVP

**Status:** Draft for review
**Author:** Golden
**Last updated:** July 14, 2026
**One-liner:** Cursor for Canvas courses — a professor imports a course, tells an agent how to change it, reviews the proposed edits, and exports back to Canvas.

---

## Problem Statement

Conscientious professors update their courses every semester based on student feedback, their own teaching intuition, and new research — but *executing* those updates is brutally tedious. A single intended change ("make the week-5 material harder," "cut the outdated framework, add the new one") ripples across many artifacts — pages, quizzes, and the way concepts are framed — and the professor has to hold all of that context in their head and hand-edit each piece in Canvas. The deciding is not the bottleneck; the mechanical, consistent propagation of decisions across a course is. Today that work is slow enough that most course content quietly rots.

## Background & Key Decisions (from discovery)

- **The professor supplies the intent.** Professors have strong intuition about what needs to change. The MVP does *not* try to tell them what to fix. It executes changes they've already decided on.
- **Value = execution speed + consistency, not insight.** This is the whole bet for v1. The product wins only if reviewing the agent's edits is *dramatically* faster than making them by hand.
- **Analytics is V2.** Tracking student interactions ("PostHog for courses") to *generate* the change signal is explicitly deferred. It becomes the reason-for-each-change layer later; it is not in the MVP.
- **Canvas structure = location, not dependency.** We mirror Canvas's model (modules → items: pages, quizzes, files), but Canvas stores containment, not the semantic links between a slide, a reading, and the exam question that tests it. Real cross-artifact propagation requires inferring those links — see Open Questions.
- **Canvas-native content first.** Pages and quizzes are structured and API-editable. Files (PPTX/PDF) are opaque blobs and far harder to edit and write back. MVP handles pages and quizzes; files are out of scope.

---

## Goals

1. **A professor can complete a real semester's worth of intended edits faster in-tool than by hand.** Target: at least 50% reduction in self-reported editing time for a representative update, in concierge/beta testing.
2. **Edits clear the professor's review bar with minimal rework.** Target: ≥70% of agent-proposed changes accepted with no or trivial edits.
3. **Round-trip integrity.** A course imported from Canvas, edited, and exported back reproduces cleanly — no lost content, broken quizzes, or scrambled formatting. Target: zero data-loss incidents across beta courses.
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
- As an instructor, I want to export the edited course back to Canvas so that the changes appear in the real course my students use.
- As an instructor, I want to preview or stage the export (and undo) so that I'm not afraid of breaking my live course.

**Edge / trust**
- As an instructor, I want a clear warning when a change touches a quiz's correct answers or point values so that I never silently ship a grading error.
- As an instructor, I want to see which items were *not* touched so that I can confirm the scope of what changed.

---

## Requirements

### Must-Have (P0)

**P0-1 — Canvas import**
Connect to Canvas (OAuth) and import a selected course's modules, pages, and quizzes into an internal structured representation (modules → items).
- Given a connected Canvas account, when the instructor selects a course, then its modules, pages, and quizzes are imported and displayed in a module/item tree.
- Files (PPTX/PDF) are listed as read-only context but not editable.
- Import is non-destructive; the source Canvas course is untouched on import.

**P0-2 — Structured internal course model**
Represent the course as editable objects (page = rich text/HTML; quiz = questions, options, correct answers, points) — the "codebase" the agent operates on.
- Round-trips losslessly: import → export with no edits reproduces the original content.

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

**P0-6 — Export back to Canvas**
Push the edited pages and quizzes back to the Canvas course.
- Given accepted changes, when the instructor exports, then Canvas reflects the edits.
- Quiz structure (questions, correct answers, points) writes back correctly.
- Export is previewable and the instructor confirms before anything writes to Canvas.

**P0-7 — Quiz-safety guardrails**
Any change to a quiz's correct answers, point values, or question count is explicitly flagged in the diff.
- The instructor cannot export a quiz-answer change without an explicit confirmation step.

### Nice-to-Have (P1)

- **P1-1 — Cross-item propagation.** When editing a concept, surface *other* items that reference it and offer to update them together (a first, shallow step toward real dependency propagation).
- **P1-2 — "Proposed semester update" entry point.** Instead of a blank chat box, let the instructor paste their feedback notes / intended changes and have the agent open with a proposed set of edits to react to. (Addresses the blank-agent-box problem.)
- **P1-3 — Export to a new/unpublished Canvas course or module** as a safe staging target rather than overwriting the live course.
- **P1-4 — Change summary / changelog** the instructor can export (what changed this semester and why).
- **P1-5 — Undo/rollback** of a completed export.

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
- **[Engineering] Canvas API write-back fidelity for quizzes** — do the New Quizzes vs. Classic Quizzes APIs let us write questions/answers/points cleanly? Confirm early; this can constrain P0-6/P0-7.
- **[Engineering] OAuth / institutional permissions** — can an individual instructor authorize import/export without an LMS admin, or does procurement/IT block bottom-up adoption? (FERPA/privacy implications even without student data.)
- **[Design] Blank agent box vs. proposed-update entry point** — do professors get value typing into an empty agent, or do they need the P1-2 "here's a proposed set of changes, react to it" opener on day one?
- **[Engineering/Design] Diff representation for rich content** — how do we show a clean, trustworthy before→after for HTML pages and quiz questions so review is genuinely fast?

---

## Timeline / Phasing

- **Phase 0 — Concierge validation (before building):** Take one real professor's course + their real intended next-semester changes. Hand-produce the edited pages and quizzes. Answer the two blocking questions: does the output clear their review bar, and does pages-and-quizzes-only cover enough? Cheapest possible test of the core bet.
- **Phase 1 — MVP (P0-1…P0-7):** Import → agent edit with reviewable diffs → export, Canvas pages and quizzes, quiz-safety guardrails. Beta with ≥3 professors running genuine updates.
- **Phase 2 — P1 fast-follows:** Proposed-update entry point, shallow cross-item propagation, staging export, changelog, rollback.
- **Later — V2:** File editing and the analytics/change-signal layer.
