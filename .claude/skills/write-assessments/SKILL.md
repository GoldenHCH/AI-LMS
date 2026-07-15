---
name: write-assessments
description: Write quizzes, tests, and assignments for a Canvas course from learning objectives and their topics/terms. Produces Canvas-API-ready JSON (New Quizzes items or Assignments) that validates before upload. Use when the professor asks to "write a quiz", "create a test", "add questions on X", "make an assignment", "build an exam for module N", or any request to generate new assessment material — even if they don't name a format.
---

# Write Assessments

Generate quiz/test questions and assignments that upload cleanly to Canvas and trace every item back to a learning objective.

## North Star: learning objectives

Every question and every assignment must serve a specific learning objective. This is the product's core bet — alignment is what separates us from generic AI chat.

- If the professor supplies objectives, use them verbatim and assign stable IDs (`LO1`, `LO2`, …).
- If they supply only topics/terms, draft objectives from the topics first (one line each, observable verb). **If you can ask, ask** — confirm the objectives before writing items, because everything downstream inherits their errors.
- **If you can't ask** (batch run, no reply coming), don't stall: draft the objectives, write the assessment, and open your summary with the drafted objectives flagged as *unconfirmed — please check these first*, above the artifact. The failure mode to avoid isn't proceeding without confirmation; it's letting invented objectives look like the professor's own. Surfacing beats stalling; burying is what's forbidden.
- No objective may go untested (no orphan objectives), and no item may exist without an objective (no orphan items). The validator enforces this.

## Inputs

| Input | Required | Notes |
|---|---|---|
| Learning objectives | yes (or derivable from topics) | one observable behavior each |
| Topics / terms | no | vocabulary the items should use |
| Assessment type | no | quiz, test/exam, or assignment; infer from the request |
| Item count / total points | no | default: 2 items per objective, 1 point per item |
| Module / course context | no | imported course content to ground items in |

## Workflow

1. **Blueprint first.** Before writing any question, build a coverage plan: for each objective, decide how many items and which question types.

   **For quizzes and tests:** default 2+ items per objective, 1 point each. Match item type to the objective's verb — recall verbs (define, identify, list) suit choice/true-false/matching; application and analysis verbs (apply, compare, calculate, evaluate) need scenario-based choice items, numeric items, or essay prompts. A mismatch (an "analyze" objective tested by a definition-recall item) is the most common alignment failure.

   **For assignments:** the unit is the rubric criterion, not the item — one criterion per objective. Item counts don't apply. One rich task that exercises every objective usually beats several thin ones; the rubric is what carries the coverage.

   **Reach past recognition.** LLM-generated items empirically skew easy, so each objective wants at least one item that makes the student *do* something, not just recognize something. When the objective's own verb is recall-level ("identify the phases"), the verb wins — don't inflate the cognitive demand past what the professor asked for. Instead make the recall non-trivial: give a case the student must read the answer out of, rather than a term to match. Wrapping a definition in flavor text is not application; if the student can still answer by spotting the keyword, nothing was gained.

   **Auto-gradable by default when they say "quiz".** Professors saying "quiz" usually mean something that grades itself on submission. Prefer scenario-based choice items over essays there, even for "explain" verbs — a well-built scenario MC can test explanation. Reserve essay and other hand-graded items for explicit "test"/"exam"/"assignment" requests, or when the professor accepts manual grading. If an objective genuinely can't be assessed without an essay, include it and say why in your summary so they can swap it.
2. **Write items** following the pedagogy rules below.
3. **Assemble the output envelope** (schema below). Exact Canvas payload shapes per question type are in `references/canvas-new-quiz-format.md`; assignments in `references/canvas-assignment-format.md`. Follow them exactly — Canvas rejects or silently mangles malformed payloads.
4. **Validate:** run `node scripts/validate-canvas-payload.mjs <output-file>` from the repo root. Fix every error and re-run until it exits 0. Never hand the professor unvalidated JSON.
5. **Present for review:** show a compact table (item # → objective → type → points) plus the questions themselves. The professor approves before anything is uploaded. Never mark anything `published`.

## Pedagogy rules

(Research-backed; see `references/assessment-design.md` for the full rationale.)

- **Bloom-verb match** — the item must demand the same cognitive level as its objective's verb. Use the verb match for QA only, never to sequence difficulty.
- **One item, one objective.** Every item tags exactly one objective — never zero, never several.
- **Distractors are near-misses.** Each wrong option is a plausible error — a confusable term or a real misconception. Draw first from the professor's own topics/terms list; when that list is too small to fill an item, reach into the course's wider subject vocabulary (a term from an adjacent week, a commonly confused concept) and note in your summary that you did. What's out of bounds is inventing options no student would ever believe. All options grammatically parallel, similar length, no "all of the above".
- **Feedback on every item.** Write specific feedback for correct and incorrect responses — why the right answer is right, what misconception each distractor reflects. Feedback roughly doubles the learning effect of retrieval practice.
- **Stems set up the question; they don't answer it.** A student who mastered the objective should be able to answer from the stem without reading the options — but a stem that narrates the answer lets an unprepared student keyword-match their way to it. After writing each item, read the correct option against the stem: if it paraphrases something the stem already said, the item tests reading, not learning. Rewrite so the stem gives the situation and the option supplies the reasoning. No negatives in stems unless bolded and essential.
- **Assignments get rubrics.** Rubric criteria come from the objective's verb; each criterion names observable behavior at each rating level.

## Output envelope

Write one JSON file per assessment. ALWAYS use this exact envelope:

```json
{
  "artifact_type": "new_quiz",
  "title": "Week 3 Quiz: Photosynthesis",
  "objectives": [
    { "id": "LO1", "text": "Describe the light-dependent reactions of photosynthesis." }
  ],
  "canvas": {
    "quiz": { "...": "POST /api/quiz/v1/courses/:course_id/quizzes body — see references" },
    "items": [ { "...": "POST .../quizzes/:assignment_id/items bodies, in position order" } ]
  },
  "alignment": [
    { "item_position": 1, "objective_id": "LO1", "bloom_verb": "describe" }
  ]
}
```

For assignments, `artifact_type` is `"assignment"` and `canvas` holds a single `assignment` object (plus optional `rubric`); alignment entries reference rubric criteria instead of item positions.

Rules the validator enforces: unique contiguous item positions, every alignment ID resolves, no orphan objectives or items, every choice item has exactly one correct answer among ≥3 options, `published` is never true, points are consistent.

## Safety (non-negotiable, from CLAUDE.md)

- Never set `published: true` — the professor publishes after review in Canvas.
- **When editing an existing quiz, lead your summary with any change to a correct answer, point value, or question count.** Not a footnote, not a row buried in a diff table — the first thing they read. A silent grading error is the worst bug this product can ship.
- **Ask whether students have already taken it.** Changing an answer key on an administered quiz doesn't just fix the question — it retroactively re-grades every submission, turning students who answered correctly under the old key into wrong answers. The professor may fully intend that (it's the normal fix for a bad question) but they have to *decide* it, and they can only decide what they've been shown. If you can't ask, say plainly in the summary: "If students have already taken this, changing the key will re-grade their submissions — check before you export."
- Propose; don't push. Output JSON is a proposal until the professor confirms export.
- Execute what they asked for; don't relitigate it. If they want a question weighted at 3 points, weight it at 3 points. You can note a mechanical consequence in one line — but the professor decides what changes, and this skill executes. That's the product's bet.
