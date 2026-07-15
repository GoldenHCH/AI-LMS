# Issue #1 findings: Canvas quiz write-back fidelity

Status: **OPEN — live Classic evidence failed the required text/UI fidelity gate.**

## Live run

- **Run date:** July 14, 2026 (America/Denver); report timestamp July 15, 2026 UTC.
- **Canvas environment:** `byu.instructure.com`, isolated test course `30971`, Classic Quiz
  `524508`, question `5803776`.
- **Safety state:** course unpublished and non-public; zero quiz submissions; one eligible
  multiple-choice question. The quiz itself was published, and the user explicitly authorized
  the probe's `--allow-published` exception for this test fixture.
- **Evidence:** `spikes/quiz_writeback/reports/classic.json` (sanitized and locally ignored).

| Check | Programmatic result | Canvas UI result |
| --- | --- | --- |
| Unchanged write-back | PASS; no differing paths | Not applicable; content remained unchanged |
| Question stem edit | **FAIL**; `$.question_text` differed from the requested payload | **FAIL**; temporary edit was not visible |
| Answer option edit | **FAIL**; `$.answers[0].answer_text` differed | **FAIL**; temporary edit was not visible |
| Correct answer edit | PASS; requested answer weights were returned | Not verified; user reported no temporary edit visible |
| Point-value edit | PASS; requested points were returned | Not verified; user reported no temporary edit visible |
| Automatic restoration | PASS; exact payload comparison succeeded | PASS; user confirmed the original state |

The probe exited `1` as designed because the stem, option, and UI gates did not pass. The access
token and full quiz content are absent from the report.

## Go / no-go decision

- **Classic Quizzes: NO-GO for the MVP editable path.** The live BYU fixture preserved an
  unchanged write and restored exactly, but it did not accept the requested stem or option
  text and the temporary edits were not visible in Canvas. Correct-answer and point updates
  alone are insufficient for editable quiz support.
- **New Quizzes: NO-GO for editable MVP scope.** No isolated New Quiz fixture was available for
  live evidence. The model and
  adapter import ordinary questions, stimuli, and bank-backed content losslessly. The importer
  marks New Quizzes read-only by default. Even after ordinary question editing is enabled,
  stimuli, bank entries, and banks must remain read-only because Canvas documents those item
  types as GET-only.

The final supported quiz-engine scope is therefore **read-only import for both engines; no quiz
engine is approved for production write-back**. Issue #1 remains open and continues to block
production quiz export.

## Endpoint characterization

| Engine | Operation | Endpoint |
| --- | --- | --- |
| Classic | Read quiz | `GET /api/v1/courses/:course_id/quizzes/:id` |
| Classic | List questions | `GET /api/v1/courses/:course_id/quizzes/:quiz_id/questions` |
| Classic | Update question | `PUT /api/v1/courses/:course_id/quizzes/:quiz_id/questions/:id` |
| Classic | Reorder questions/groups | `POST /api/v1/courses/:course_id/quizzes/:id/reorder` |
| New | Read quiz | `GET /api/quiz/v1/courses/:course_id/quizzes/:assignment_id` |
| New | Update quiz | `PATCH /api/quiz/v1/courses/:course_id/quizzes/:assignment_id` |
| New | List items | `GET /api/quiz/v1/courses/:course_id/quizzes/:assignment_id/items` |
| New | Update ordinary question item | `PATCH /api/quiz/v1/courses/:course_id/quizzes/:assignment_id/items/:item_id` |

Primary documentation:

- [Classic Quizzes API](https://canvas.instructure.com/doc/api/quizzes.html)
- [Classic Quiz Questions API](https://canvas.instructure.com/doc/api/quiz_questions.html)
- [canvasapi 3.6.0 Quiz reference](https://canvasapi.readthedocs.io/en/stable/quiz-ref.html)
- [New Quizzes API](https://canvas.instructure.com/doc/api/new_quizzes.html)
- [New Quiz Items API](https://canvas.instructure.com/doc/api/new_quiz_items.html)

## Fields and structures not safely writable

- Classic `question_text` and answer `answer_text` through the current `canvasapi` question
  update payload on the tested BYU fixture. Canvas returned the original/different text at
  those paths, so these are unreliable until a subsequent isolated fixture proves otherwise.
- Classic correct-answer weights and points were accepted by the API, but the combined edit was
  not verified in Canvas UI and does not qualify the engine for write-back.
- New Quiz `Stimulus`, `BankEntry`, and `Bank` items: Canvas documents retrieval only.
- New Quiz server-managed fields such as `entry_editable`, `status`, IDs, and timestamps.
- All New Quiz question types, including ordinary choice items, because no live New Quiz probe
  was available. Their complete raw payloads are retained, but that does not prove the server
  accepts every field on update.
- Classic question groups, question-bank linkage, and server-managed IDs are outside this
  question-level probe. They remain in raw payloads and must not be rewritten casually.
- Published quizzes remain rejected by default. This run used an explicitly authorized
  exception on a zero-submission test fixture; that exception does not weaken production gates.

## Canvas normalization

- The unchanged write produced no differing paths: no HTML, whitespace, entity, attribute,
  answer-payload, ID, or ordering normalization was observed.
- Automatic restoration also produced an exact comparison.
- The requested stem and option edits differed at their text paths and were not visible in the
  UI. This is treated as an ignored/rejected write and meaningful fidelity failure, **not** as
  harmless normalization.

## Live evidence checklist

- [x] Classic unchanged write has no reported differences.
- [ ] Classic stem, option, correct-answer, and points edits appear in Canvas UI — **failed**.
- [x] Classic automatic restore succeeds programmatically and in Canvas UI.
- [x] New Quiz fixture availability assessed; none was available, so New remains read-only.
- [x] New `Stimulus`, `BankEntry`, `Bank`, server-managed fields, and untested question types are
  documented as GET-only or unreliable.
- [x] Canvas normalization and meaningful text-write failures are distinguished above.
- [ ] Final engine scope decision is copied to the Issue #1 thread.
