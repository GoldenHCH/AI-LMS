---
name: write-assessments
description: Write quizzes, tests, and assignments for a Canvas course from learning objectives and their topics/terms. Produces Canvas-API-ready JSON (New Quizzes items or Assignments) that validates before upload. Use when the professor asks to "write a quiz", "create a test", "add questions on X", "make an assignment", "build an exam for module N", or any request to generate new assessment material — even if they don't name a format.
---

# Write Assessments

Generate quiz/test questions and assignments that upload cleanly to Canvas and trace every item back to a learning objective.

## North Star: learning objectives

Every question and every assignment must serve a specific learning objective. This is the product's core bet — alignment is what separates us from generic AI chat.

- If the professor supplies objectives, use them verbatim and assign stable IDs (`LO1`, `LO2`, …).
- If they supply only topics/terms, draft objectives from the topics first (one line each, observable verb), show them to the professor, and get confirmation before writing items. Don't bury invented objectives inside a finished quiz.
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

1. **Blueprint first.** Before writing any question, build a coverage plan: for each objective, decide how many items and which question types. Default 2+ items per objective, and at least one application-level item (scenario, calculation, transfer task) per objective — LLM-generated items empirically skew easy, so recognition-only coverage under-tests. Match item type to the objective's verb as a heuristic: recall verbs (define, identify, list) suit choice/true-false/matching; application and analysis verbs (apply, compare, calculate, evaluate) need scenario-based choice items, numeric items, or essay prompts. A mismatch (an "analyze" objective tested by a definition-recall item) is the most common alignment failure. Use Bloom verbs only for this matching — never to sequence items or infer difficulty.
2. **Write items** following the pedagogy rules below.
3. **Assemble the output envelope** (schema below). Exact Canvas payload shapes per question type are in `references/canvas-new-quiz-format.md`; assignments in `references/canvas-assignment-format.md`. Follow them exactly — Canvas rejects or silently mangles malformed payloads.
4. **Validate:** run `node scripts/validate-canvas-payload.mjs <output-file>` from the repo root. Fix every error and re-run until it exits 0. Never hand the professor unvalidated JSON.
5. **Present for review:** show a compact table (item # → objective → type → points) plus the questions themselves. The professor approves before anything is uploaded. Never mark anything `published`.

## Pedagogy rules

(Research-backed; see `references/assessment-design.md` for the full rationale.)

- **Bloom-verb match** — the item must demand the same cognitive level as its objective's verb. Use the verb match for QA only, never to sequence difficulty.
- **One item, one objective.** Every item tags exactly one objective — never zero, never several.
- **Distractors are near-misses from the course's own vocabulary.** Each wrong option is a plausible error — a confusable term or misconception drawn from the module's topics/terms list, never invented from outside the course. All options grammatically parallel, similar length, no "all of the above".
- **Feedback on every item.** Write specific feedback for correct and incorrect responses — why the right answer is right, what misconception each distractor reflects. Feedback roughly doubles the learning effect of retrieval practice.
- **Stems are self-contained.** A student who mastered the objective should answer from the stem alone, without reading the options first. No negatives in stems unless bolded and essential.
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
- When *editing* an existing quiz (not creating), any change to a correct answer, point value, or question count must be called out explicitly in your summary — a silent grading error is the worst possible bug.
- Propose; don't push. Output JSON is a proposal until the professor confirms export.
