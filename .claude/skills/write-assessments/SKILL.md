---
name: write-assessments
description: Write quizzes, tests, exams, assignments, and rubrics for a Canvas course, built from learning objectives. Settles the shape first (how many questions, which types, points, time limit), then emits Canvas-API-ready JSON that validates before upload. Use when a professor wants new, extended, or corrected assessment material - "write a quiz", "create a test", "build the unit exam", "make an assignment", "add questions on X", "write practice problems", "I need a rubric", "make a make-up test", "fix question 4", "bump that question to 3 points", "something to check they understood the reading" - including when they describe what students should be able to DO rather than naming a format, and including edits to existing quizzes (fixing a wrong answer key, changing point values or question counts - but NOT regrading students against a key). Always for a Canvas course, never for building quiz software. Not for analyzing quiz results or regrading submissions, not for importing/exporting courses, and not for writing reading material (that is write-content).
---

# Write Assessments

Generate quiz/test questions and assignments that upload cleanly to Canvas and trace every item back to a learning objective.

## North Star: learning objectives

Every question and every assignment must serve a specific learning objective. This is the product's core bet — alignment is what separates us from generic AI chat.

- If the professor supplies objectives, use them verbatim and assign stable IDs (`LO1`, `LO2`, …).
- If they supply only topics/terms, draft objectives from the topics first (one line each, observable verb). **If you can ask, ask** — confirm the objectives before writing items, because everything downstream inherits their errors.
- **If you can't ask** (batch run, no reply coming), don't stall: draft the objectives, write the assessment, and open your summary with the drafted objectives flagged as *unconfirmed — please check these first*, above the artifact. The failure mode to avoid isn't proceeding without confirmation; it's letting invented objectives look like the professor's own. Surfacing beats stalling; burying is what's forbidden.
- No objective may go untested (no orphan objectives), and no item may exist without an objective (no orphan items). The validator enforces this.

## Intake: get the shape before you write

A professor asking for "a quiz" has a specific quiz in their head — 10 questions, all multiple choice, 20 minutes, worth 5% of the grade. Guess wrong on any of that and they rewrite it by hand, which is the one outcome this product exists to prevent. So settle the shape first.

**Open with the goal, not a form.** If they haven't said, ask what the assessment is *for* — a low-stakes weekly check, a unit test, a make-up exam? That single answer implies most of the rest (a weekly check is short, auto-graded, retakeable; a unit test isn't), and it's a question professors enjoy answering. Then fill the remaining gaps in **one** round of questions, not a serial interrogation.

**Read before you ask.** The course is already imported. Pull the module's existing pages, terms, and prior quizzes yourself and ask them to *confirm* — "I pulled these terms from your Module 4 page: …, ok?" beats "what terms should I use?". Only ask for what isn't in the course.

**What to settle, and what to do if they don't say:**

| Ask | Why it changes the artifact | Default if unanswered |
|---|---|---|
| **Objectives** | everything traces to them | draft from topics, flag unconfirmed |
| **How many questions** | drives coverage per objective | 2 per objective |
| **Which question types** | MC, true/false, matching, multi-select, essay, numeric | auto-gradable mix; no essay unless they ask |
| **Points** | equal, or some worth more? | 1 point each, equal |
| **Time limit** | unlimited, or how many minutes? | unlimited (`has_time_limit: false`) |
| **Retakes** | one attempt or several? | one attempt |
| **Topics / terms** | the vocabulary items and distractors draw on | read from the module; confirm |
| **Preferred examples or scenarios** | professors often have a case they always use | propose your own; see below |

**Propose; don't just collect.** Where an objective needs an application item, don't ask "what scenario would you like?" — that hands them the work. Draft two or three scenarios grounded in their course material and ask which fits. Same for topic coverage: if their objectives leave an obvious gap, name it rather than quietly filling it. Suggesting is the job; interrogating is not.

If no answer is coming (batch run), take every default above, write the assessment, and list the assumptions at the top of your summary so they can correct in one pass instead of discovering them item by item.

## Workflow

1. **Blueprint first.** Before writing any question, build a coverage plan from the intake: how many items per objective, which type each is, what it's worth. Show it to the professor when it diverges from what they asked for — "you wanted 6 questions across 3 objectives, so LO2 gets one item; it's the 'analyze' objective, so I'd rather give it two and trim LO1" is a 10-second decision for them and a rewrite avoided.

   **Honor the count they gave.** If they said 10 questions, write 10. Distribute across objectives by weight, not evenly — the objective their exam cares about most gets more items. If their count can't cover every objective (5 questions, 7 objectives), say so and ask what to cut rather than silently under-testing something.

   **Match item type to the objective's verb** within the types they allowed: recall verbs (define, identify, list) suit choice/true-false/matching; application and analysis verbs (apply, compare, calculate, evaluate) need scenario-based choice items, numeric items, or essay prompts. A mismatch (an "analyze" objective tested by a definition-recall item) is the most common alignment failure. If they ruled out the type an objective needs — "no essays" on an "evaluate" objective — build the scenario MC instead and say what it costs.

   **Points follow their scheme.** Equal by default. If they said some questions are worth more, weight by cognitive demand (the application item, not the recall one) and make `quiz.points_possible` match the sum — the validator enforces that, because a mismatch grades against the wrong denominator silently.

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

For assignments, `artifact_type` is `"assignment"` and `canvas` holds a single `assignment` object (plus optional `rubric`); alignment entries use `criterion_key` instead of `item_position`.

`bloom_verb` is **the objective's verb**, copied from the objective text — not a verb describing the item. It's there so a reviewer can scan the alignment table and see whether the item's actual demand matches what the objective asked for; that comparison only works if the column is always the same side of it.

Rules the validator enforces: unique contiguous item positions, every alignment ID resolves, no orphan objectives or items, every choice item has exactly one correct answer among ≥3 options, `published` is never true, points are consistent.

## Safety (non-negotiable, from CLAUDE.md)

- Never set `published: true` — the professor publishes after review in Canvas.
- **When editing an existing quiz, lead your summary with any change to a correct answer, point value, or question count.** Not a footnote, not a row buried in a diff table — the first thing they read. A silent grading error is the worst bug this product can ship.
- **Ask whether students have already taken it.** Changing an answer key on an administered quiz doesn't just fix the question — it retroactively re-grades every submission, turning students who answered correctly under the old key into wrong answers. The professor may fully intend that (it's the normal fix for a bad question) but they have to *decide* it, and they can only decide what they've been shown. If you can't ask, say plainly in the summary: "If students have already taken this, changing the key will re-grade their submissions — check before you export."
- Propose; don't push. Output JSON is a proposal until the professor confirms export.
- Execute what they asked for; don't relitigate it. If they want a question weighted at 3 points, weight it at 3 points. You can note a mechanical consequence in one line — but the professor decides what changes, and this skill executes. That's the product's bet.
