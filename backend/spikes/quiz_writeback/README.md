# Canvas quiz write-back spike

These probes characterize the exact Canvas instance that will back the MVP. Run them only
against an isolated, unpublished test course with no student submissions. Both probes require
an explicit write flag and exact course-ID confirmation. By default they restore the original
question in a `finally` block.

Install dependencies and set credentials without committing them:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt
export CANVAS_BASE_URL=https://your-school.test.instructure.com
export CANVAS_ACCESS_TOKEN=your-test-token
```

Classic Quiz:

```bash
python -m spikes.quiz_writeback.classic \
  --course-id 123 \
  --quiz-id 456 \
  --confirm-test-course 123 \
  --allow-write \
  --report /tmp/classic-quiz-spike.json
```

For a safe Canvas UI check, add `--pause-for-ui`. The probe holds the original question only
in memory, pauses with the temporary edit visible, restores it in `finally`, and pauses once
more for restoration verification. Enter `EDIT_VERIFIED` after checking the four edits and
`RESTORE_VERIFIED` after refreshing Canvas and checking the original state.

`--allow-published` is an exceptional override for a deliberately isolated test fixture. Use
it only after confirming there are no submissions and recording explicit authorization.

New Quiz (use the assignment ID associated with the quiz):

```bash
python -m spikes.quiz_writeback.new \
  --course-id 123 \
  --assignment-id 789 \
  --confirm-test-course 123 \
  --allow-write \
  --report /tmp/new-quiz-spike.json
```

Each probe writes a question unchanged, verifies a temporary stem/option/correct-answer/point
edit, and restores the original. `--leave-edited` remains available for deliberate manual
inspection, but `--pause-for-ui` is safer because restoration stays inside the guarded probe.
Reports list changed JSON paths and verification booleans but never include the access token or
full course content.

Attach the generated reports and UI observations to the Issue #1 findings before enabling a
quiz engine for production export.
