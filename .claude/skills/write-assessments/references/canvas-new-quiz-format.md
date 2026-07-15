# Canvas New Quizzes API — write payloads

Verified against Instructure docs (full reference with sources: `~/Research/canvas-lti-edtech/canvas-api-write-payloads.md`). The repo's `canvas_import/canvas/new_quizzes.py` client already speaks these endpoints.

## Endpoints

- Create quiz: `POST /api/quiz/v1/courses/:course_id/quizzes` — body wraps in `quiz`
- Add item: `POST /api/quiz/v1/courses/:course_id/quizzes/:assignment_id/items` — body wraps in `item`
- Update item: **`PATCH`** `.../items/:item_id` (New Quizzes items are the one PATCH endpoint; Assignments/Pages use PUT)

## Quiz object

```json
{
  "quiz": {
    "title": "Week 3 Quiz: The Light Reactions",
    "instructions": "<p>Answer every question. You may retake this once.</p>",
    "points_possible": 6,
    "quiz_settings": {
      "shuffle_answers": true,
      "shuffle_questions": false,
      "has_time_limit": false,
      "calculator_type": "none",
      "multiple_attempts": { "multiple_attempts_enabled": false }
    }
  }
}
```

`points_possible` should equal the sum of item points. Never set `published: true`.

## Item envelope (every question type)

```json
{
  "item": {
    "entry_type": "Item",
    "points_possible": 1,
    "position": 1,
    "entry": {
      "title": "Short label for the question bank",
      "item_body": "<p>The question stem, as HTML.</p>",
      "interaction_type_slug": "choice",
      "interaction_data": { "...": "per-type, see below" },
      "scoring_data": { "...": "per-type, see below" },
      "scoring_algorithm": "Equivalence",
      "feedback": { "correct": "<p>...</p>", "incorrect": "<p>...</p>", "neutral": "" },
      "answer_feedback": { "<choice-uuid>": "<p>Per-option feedback.</p>" }
    }
  }
}
```

`position` starts at 1 and must be contiguous. `feedback` and `answer_feedback` are where the pedagogy lives — feedback roughly doubles the learning effect of a quiz, so never ship an item without it.

## Per-type shapes

### `choice` — multiple choice (the default)

```json
{
  "interaction_type_slug": "choice",
  "interaction_data": {
    "choices": [
      { "id": "96e68487-086e-4a0b-9a70-0ad623c83aa3", "position": 1, "itemBody": "<p>Paris</p>" },
      { "id": "86c4f713-94fe-4adf-9c2c-972d68f6e739", "position": 2, "itemBody": "<p>London</p>" },
      { "id": "b1c2d3e4-0000-4a0b-9a70-0ad623c83aa3", "position": 3, "itemBody": "<p>Berlin</p>" }
    ]
  },
  "scoring_data": { "value": "96e68487-086e-4a0b-9a70-0ad623c83aa3" },
  "scoring_algorithm": "Equivalence"
}
```

- Choice `id`s are **client-generated UUIDs** — you invent them; Canvas does not assign them. `scoring_data.value` echoes the correct one.
- Note the casing trap: choices here use **`itemBody`** (camelCase), while `multi-answer`, `matching`, `ordering`, and the rest use `item_body`. This inconsistency is in Instructure's own docs — the validator accepts either, but follow the doc convention per type.
- `scoring_algorithm`: `Equivalence` (one correct answer) or `VaryPointsByAnswer` (partial credit; `scoring_data` gains a `values` array of `{value, points}`).
- Minimum 3 options for a real question: one correct, two-plus near-miss distractors.

### `multi-answer` — select all that apply

```json
{
  "interaction_type_slug": "multi-answer",
  "interaction_data": {
    "choices": [
      { "id": "<uuid-1>", "position": 1, "item_body": "<p>2</p>" },
      { "id": "<uuid-2>", "position": 2, "item_body": "<p>3</p>" },
      { "id": "<uuid-3>", "position": 3, "item_body": "<p>4</p>" }
    ]
  },
  "scoring_data": { "value": ["<uuid-1>", "<uuid-2>"] },
  "scoring_algorithm": "AllOrNothing"
}
```

`scoring_algorithm`: `AllOrNothing` or `PartialScore`.

### `true-false`

```json
{
  "interaction_type_slug": "true-false",
  "interaction_data": { "true_choice": "True", "false_choice": "False" },
  "scoring_data": { "value": true },
  "scoring_algorithm": "Equivalence"
}
```

### `essay` — manually graded

```json
{
  "interaction_type_slug": "essay",
  "interaction_data": {
    "rce": true, "word_count": true, "spell_check": true,
    "word_limit_enabled": true, "word_limit_max": "1000", "word_limit_min": "0",
    "file_upload": false, "essay": null
  },
  "scoring_data": { "value": "Grading notes shown to the grader." },
  "scoring_algorithm": "None"
}
```

`scoring_data.value` is grading guidance, not an answer key. Algorithm is always `None`.

### `matching`

```json
{
  "interaction_type_slug": "matching",
  "interaction_data": {
    "answers": ["Paris", "Tokyo", "Cairo"],
    "questions": [
      { "id": "10586", "item_body": "France" },
      { "id": "38821", "item_body": "Japan" }
    ]
  },
  "scoring_data": {
    "value": { "10586": "Paris", "38821": "Tokyo" },
    "edit_data": {
      "matches": [
        { "question_id": "10586", "question_body": "France", "answer_body": "Paris" },
        { "question_id": "38821", "question_body": "Japan", "answer_body": "Tokyo" }
      ],
      "distractors": ["Cairo"]
    }
  },
  "scoring_algorithm": "DeepEquals"
}
```

Extra strings in `answers` that appear in no match are distractors — a natural place for near-miss terms.

`scoring_algorithm`: `DeepEquals` (all pairs right or zero) or `PartialDeep` (credit per correct pair). Prefer **`PartialDeep` for matching items with three or more pairs** — under `DeepEquals` a student who knows four of five pairs scores the same as one who knows none, which tells you nothing and reads as unfair. Reserve `DeepEquals` for two-pair items or when the professor wants all-or-nothing.

### `numeric`

```json
{
  "interaction_type_slug": "numeric",
  "interaction_data": {},
  "scoring_data": {
    "value": [
      { "id": "1", "type": "exactResponse", "value": "212" }
    ]
  },
  "scoring_algorithm": "Numeric"
}
```

`interaction_data` is empty — all config lives in `scoring_data.value`, an array of accepted-answer rules. Include only the rules you need. Rule types: `exactResponse` (`value`), `marginOfError` (`value`, `margin`, `margin_type`), `withinARange` (`start`, `end`), `preciseResponse` (`value`, `precision`, `precision_type`).

## Other types

Canvas also supports `categorization`, `rich-fill-blank`, `formula`, `ordering`, `file-upload`, and `hot-spot`. They're real but shape-heavy (nested per-element scoring algorithms, image coordinates). The validator covers the six types above — the ones that carry nearly all real quiz weight. If you need another type, read the full reference at `~/Research/canvas-lti-edtech/canvas-api-write-payloads.md` first and extend `QUIZ_ITEM_SPECS` in the validator rather than emitting unvalidated JSON.
