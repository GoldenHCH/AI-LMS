# Canvas Assignments + Rubrics API — write payloads

Verified against Instructure docs (full reference: `~/Research/canvas-lti-edtech/canvas-api-write-payloads.md`).

## Endpoints

- Create assignment: `POST /api/v1/courses/:course_id/assignments` — body wraps in `assignment`
- Update: `PUT /api/v1/courses/:course_id/assignments/:id` (send only changed fields)
- Create + attach rubric: `POST /api/v1/courses/:course_id/rubrics` — body carries **both** `rubric` and `rubric_association`

## Assignment object

```json
{
  "assignment": {
    "name": "Photosynthesis Lab Report",
    "description": "<h2>Task</h2><p>Write a 1000-word lab report...</p>",
    "points_possible": 20,
    "submission_types": ["online_upload", "online_text_entry"],
    "allowed_extensions": ["pdf", "docx"],
    "grading_type": "points",
    "due_at": "2026-09-15T23:59:00Z",
    "published": false,
    "peer_reviews": false,
    "omit_from_final_grade": false
  }
}
```

| Field | Notes |
|---|---|
| `name` | required |
| `description` | HTML; this is where the task prompt, objectives, and expectations go |
| `points_possible` | number; should equal the rubric's total when a rubric is attached |
| `submission_types` | array. Enum: `online_text_entry`, `online_url`, `online_upload`, `media_recording`, `student_annotation`, `on_paper`, `external_tool`, `none`, `discussion_topic`, `online_quiz`, `wiki_page` |
| `grading_type` | Enum: `points`, `percent`, `letter_grade`, `gpa_scale`, `pass_fail`, `not_graded` |
| `allowed_extensions` | only meaningful with `online_upload` |
| `due_at` / `lock_at` / `unlock_at` | ISO 8601 |
| `published` | ALWAYS `false` from this skill |

## Rubric

Rubric criteria come from the objective's verb — one criterion per objective (or explicit sub-skill). This is constructive alignment applied to graded work.

```json
{
  "rubric": {
    "title": "Photosynthesis Lab Report Rubric",
    "free_form_criterion_comments": false,
    "criteria": {
      "0": {
        "description": "Describes the light-dependent reactions",
        "long_description": "Traces energy from photon capture through ATP and NADPH production.",
        "points": 10,
        "ratings": [
          { "description": "Traces all four steps and names both products", "points": 10 },
          { "description": "Traces the steps but omits or misnames a product", "points": 6 },
          { "description": "Describes photosynthesis generally without the light reactions", "points": 2 }
        ]
      }
    }
  },
  "rubric_association": {
    "association_id": 55231,
    "association_type": "Assignment",
    "use_for_grading": true,
    "purpose": "grading"
  }
}
```

**The gotcha that breaks uploads:** `criteria` is an *indexed hash* keyed `"0"`, `"1"`, `"2"` — **not a JSON array**. An array silently fails. The validator rejects arrays for this reason.

**`association_id` isn't known at generation time** — the assignment doesn't exist until Canvas returns its id. So this skill emits only the `rubric` object in `canvas.rubric`; the upload step creates the assignment first, then posts the rubric with `association_id` set to the new assignment's id and `association_type: "Assignment"`. Don't invent an id.

Other enums: `association_type` is `Assignment`, `Course`, or `Account`; `purpose` is `grading` or `bookmark`.

## Writing rubric criteria

- Highest rating's points must equal the criterion's points (the validator checks this — a mismatch means a student literally cannot earn full marks).
- Each rating describes **observable behavior**, not a quality adjective. "Thorough analysis" tells a student nothing; "Identifies all three factors and explains their interaction" is gradeable and defensible.
- Don't add criteria that map to no objective (a generic "writing quality" row) unless the professor's objectives include one.
