# Internal course model

The internal model is an LMS-agnostic, versioned JSON document. Canvas objects are converted at
the adapter boundary and are never stored directly.

```text
Course
├── modules[] (ordered)
│   └── items[] (ordered, discriminated by kind)
│       ├── Page
│       ├── Quiz
│       │   └── questions[]
│       │       └── answers[]
│       ├── FileRef (read-only)
│       └── opaque Canvas item (read-only)
└── files[] (read-only references)
```

## Fidelity rules

- `body_html`, `description_html`, `stem_html`, answer HTML, and feedback HTML are raw source
  strings. No HTML parser or plain-text conversion runs during import or persistence.
- Canvas IDs and positions are retained for courses, modules, module items, pages, quizzes,
  questions, answers, and files.
- Every mapped object retains `raw_payload`. Known editable fields are overlaid onto that
  payload for dry-run export, preserving fields this version does not interpret.
- Unsupported module items retain their complete module-item response in `opaque` and are never
  dropped.
- New Quiz type-specific structures are retained in both `type_specific` and `raw_payload`.
  Stimulus and bank-backed items carry a `read_only_reason`.
- `links` is a reserved list on content objects for future semantic relationships. It is stored
  and round-tripped but has no behavior in this phase.

## Persistence and retention

`WorkingCopyStore` is the offline fixture/test envelope and writes private files atomically with
mode `0600`. The website uses the relational Supabase mirror instead: every import receives a
random `workspace_id`, becomes inaccessible exactly 30 minutes after import, and is cascade-
deleted by a one-minute Cron cleanup. Canvas connection credentials are never included in either
representation.

## Export boundary

`CanvasAdapter.export_dry_run()` renders a Canvas-facing snapshot in memory and makes no network
request. The later confirmed-export feature must diff this working copy against its baseline,
write only accepted changed items, enforce quiz-answer confirmations, and audit educator access.
