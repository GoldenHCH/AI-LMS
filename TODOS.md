# TODOS

## Agent Chat / Batch Diff Review (#5-7)

### Widen quiz-safety predicate beyond isCorrect

**What:** The quiz-safety flag currently fires only when `isCorrect` changes on an answer. It misses semantic answer-key changes where `isCorrect` stays the same: editing the text of the currently-correct answer, reordering answers, or adding/removing a correct answer without flipping the flag on the rest.

**Why:** CLAUDE.md's non-negotiable is "any change to a correct answer... must still be flagged in review." The current check only catches the literal `isCorrect` boolean flipping, not the meaning of "correct" changing underneath it.

**Context:** Surfaced during `/plan-ceo-review` outside-voice pass (2026-07-20) on the Approach A design for #5-7 (agent chat → batch diff review). Deliberately shipped narrow for the first validation demo — revisit once real professor course content is being edited, since this is exactly the class of silent grading-relevant edit the guardrail exists to catch. Fix is a comparison-function change (`lib/courses/` diff logic once it exists), not new infrastructure.

**Effort:** S
**Priority:** P1
**Depends on:** #5-7 diff engine landing first

---

### Confirm Common Cartridge fidelity for edited (not just imported) quizzes

**What:** Phase1-Issues #1's acceptance criteria for `.imscc` export fidelity are still unchecked — the spike confirmed in-place write-back is NO-GO, but never confirmed that a quiz question *edited* by the agent (not just imported as-is) survives a Common Cartridge round trip.

**Why:** #5-7 builds an elaborate quiz-question-edit review UI on the assumption edited quiz content will export cleanly later (#9). If it doesn't, the review UI's value is contingent on an unconfirmed downstream fidelity question.

**Context:** Surfaced during `/plan-ceo-review` outside-voice pass (2026-07-20). Not blocking for building #5-7 itself (#5-7 doesn't touch export), but worth resolving before investing further in quiz-editing polish. Re-run or extend the Issue #1 spike specifically on an agent-edited quiz question, not just an unedited imported one.

**Effort:** S
**Priority:** P1
**Depends on:** None — can run independently of #5-7

**Priority bump (2026-07-20, `/plan-eng-review` outside voice):** Codex's eng-review pass argued P2 contradicts the project's own declared dependency order (#1 "blocks everything downstream" per `CLAUDE.md`). Bumped from P2 to P1.

---

### Cap agent-call payload by size, not just item count

**What:** The pre-filter caps the batch at ~20 items, but doesn't bound the actual token/byte size of what gets sent to or returned from the LLM. A single unusually large page or quiz (long body HTML, many questions) can blow past this even within the item cap.

**Why:** An oversized single item could hit provider context/output limits and fail in a confusing way, or silently truncate.

**Context:** Surfaced during `/plan-ceo-review` outside-voice pass (2026-07-20). Low likelihood to bite in early solo-tester demos with typical course content, but worth a byte-size guard (not full field-level patching) once real course variety is being tested.

**Effort:** S
**Priority:** P3
**Depends on:** #5-7 agent call landing first

---

### Exclude read-only items from the pre-filter before prompting

**What:** New Quizzes, read-only quiz questions, opaque items, and partially-imported items currently only get excluded from proposals *after* generation (via the "unsupported field, dropped" path). They aren't excluded from the pre-filter that decides what gets sent to the agent in the first place.

**Why:** Wastes agent-call budget proposing edits to something that can't be changed, and relies solely on the post-hoc drop as the only enforcement point (no defense in depth).

**Context:** Surfaced during `/plan-ceo-review` outside-voice pass (2026-07-20). The post-hoc drop already prevents an unsafe write, so this is an efficiency/robustness improvement, not a correctness gap.

**Effort:** S
**Priority:** P3
**Depends on:** #5-7 pre-filter landing first

---

### Block accept-all when the batch has a known-incomplete drop

**What:** When a single proposal is dropped (fails round-trip/unsupported-field check), the rest of the batch still renders and remains eligible for "accept all safe changes" — even though the professor's original cross-item request (e.g. "replace X everywhere") is now only partially represented.

**Why:** Accept-all on a batch known to be missing part of what was requested could leave the course in a state the professor didn't actually ask for, without them realizing part of their request silently failed.

**Context:** Surfaced during `/plan-ceo-review` outside-voice pass (2026-07-20). At minimum, accept-all should surface a visible note when the batch has a dropped item, even if it doesn't hard-block. Revisit after seeing how often real requests actually span enough items for this to matter.

**Effort:** S
**Priority:** P3
**Depends on:** #5-7 landing first

---

### Immutable baseline for export's sensitive-change computation

**What:** There's no persisted "baseline" snapshot separate from the live working copy. When export (#9) needs to compute the final summary of all answer/point/count changes for the pre-export preview, it needs a stable reference point to diff against — not just "whatever the working copy currently is."

**Why:** Without a baseline, export-time sensitive-change detection has nothing authoritative to compare the final working copy against, which weakens the #8 quiz-safety guardrail's export-time guarantee.

**Context:** Surfaced during `/plan-ceo-review` outside-voice pass (2026-07-20), as part of a broader "no baseline/staleness model" finding. The batch-concurrency half of that finding (multiple tabs/duplicate requests) was addressed in this review with a server-side proposed-state check; this half is specifically about #9's export-time needs and is naturally deferred until #9 is actually being built.

**Effort:** M
**Priority:** P2
**Depends on:** #9 (export)

---

### Guard writes against mid-call workspace expiry

**What:** A model call could begin before the 30-minute workspace deadline and finish after it — by which point the course row may already be cascade-deleted by the 1-minute cron purge. The route would then attempt to write a proposal against a course that no longer exists.

**Why:** An unguarded write in this window either throws an unhandled error or, worse, silently no-ops in a way that looks like success to the professor.

**Context:** Surfaced during `/plan-eng-review` outside-voice pass (2026-07-20). Fix is a check-before-write: confirm `expires_at > now()` immediately before persisting a proposal or applying an accept, not just at the start of the request. Distinct from the already-accepted UX risk ("a long review that runs out mid-session loses the batch") — this is about the write itself failing safely, not about extending the deadline.

**Effort:** S
**Priority:** P2
**Depends on:** #5-7 landing first

---

### Rate limit LLM calls per workspace

**What:** No quota exists on how many agent calls an anonymous workspace can trigger. Any visitor who completes an import can call the LLM provider repeatedly until their workspace expires.

**Why:** Cost-abuse surface — same-origin checks and UI locks authenticate the request but don't limit request volume.

**Context:** Surfaced during `/plan-eng-review` outside-voice pass (2026-07-20). Lower urgency given known-tester usage today; worth a simple per-workspace request counter before any wider access.

**Effort:** S
**Priority:** P3
**Depends on:** #5-7 agent call landing first

---

### Verify sanitizer allowlist against real exported content

**What:** `cleanHtml()`'s generic allowlist may strip Canvas-specific styles, embeds, or attributes that survive in the raw stored/exported HTML — meaning what the professor reviews could differ from what actually exports.

**Why:** Undermines "what you review is what you get" if the stripped content is meaningful, not decorative.

**Context:** Surfaced during `/plan-eng-review` outside-voice pass (2026-07-20). Needs checking against a real course with rich Canvas-specific markup (embeds, custom styling) rather than guessing — may turn out to be a non-issue in practice.

**Effort:** S
**Priority:** P3
**Depends on:** None

---

### Baseline version check to prevent stale-batch overwrites

**What:** The server-side "proposal must be in 'proposed' state" check (added this review to guard against concurrent actions) does not catch this: batch B is generated from course version N; batch A is accepted, moving the course to N+1; batch B's proposals are still 'proposed' (never touched), so accepting them now silently overwrites A's changes.

**Why:** This is a real data-loss path — an accepted edit silently overwritten by an unrelated, older batch — but requires two different batches targeting the same item with one accepted mid-review of the other, an unlikely sequence for a single professor exploring one request at a time.

**Context:** Surfaced during `/plan-eng-review` outside-voice pass (2026-07-20). Explicitly accepted as a risk for solo-tester usage rather than fixed. Fix, if revisited: each proposal stores the item's version/`updated_at` it was generated from; accept re-checks that baseline against the item's current version, rejecting with "this item changed since the proposal was generated" on mismatch.

**Effort:** S
**Priority:** P2
**Depends on:** #5-7 landing first

---

### RPC row-count verification on accept_change_proposals

**What:** `accept_change_proposals` (the plpgsql RPC that applies accepted proposals) never checks whether its `UPDATE`/`DELETE` statements actually matched a row. If proposal P1 removes a quiz question and is accepted first, then proposal P2 (independently created against the same live tree, still editing that same question) is accepted afterward, P2's `UPDATE` matches zero rows — no error, no rollback — and the function still marks P2 `accepted: true`. The professor is told a reviewed edit was applied when the database was never touched.

**Why:** Directly violates round-trip integrity and "never silent-edit" — the failure is silent by construction (Postgres doesn't error on a zero-row UPDATE/DELETE).

**Context:** Surfaced during a 47-agent adversarial code review (2026-07-23) of the #5-7 diff/accept pipeline, confirmed via direct reading of `supabase/migrations/20260723030000_add_accept_change_proposals_function.sql`. Sibling gap to the existing "Baseline version check to prevent stale-batch overwrites" entry above — same root cause (no staleness/version check at accept time), different manifestation (silent no-op vs. silent overwrite). Fix: add `GET DIAGNOSTICS v_row_count = ROW_COUNT` after each mutating statement and report `accepted: false, reason: 'target_removed'` (or similar) when it's zero, instead of rushing a change to the transactional core under time pressure.

**Effort:** S
**Priority:** P2
**Depends on:** None — can be fixed independently

---

### Flag answer-text edits as sensitive for answer-is-the-key question types

**What:** `computeProposalDiff` only flags a proposal sensitive via `removed`, `pointsPossible`, `isCorrect`, and (as of 2026-07-23) `weight` changes. It never reads `questionType`. For question types where the answer text itself is the correctness definition — short-answer, fill-in-the-blank, matching — editing an answer's `textHtml` changes what Canvas auto-grades as correct, but renders as a plain unflagged diff and is eligible for one-click non-sensitive batch-accept.

**Why:** This is the same class of gap the existing "Widen quiz-safety predicate beyond isCorrect" entry above describes (isCorrect-flag literalism missing semantic correctness changes) — this is the specific short-answer/matching manifestation of it.

**Context:** Surfaced during the same 2026-07-23 adversarial review. Verified that classic short-answer/matching questions do reach the diff engine fully editable (not gated read-only) via `backend/canvas_import/canvas/adapter.py`. Deliberately not fixed this session — a correct fix needs to enumerate the actual Canvas question types where text-is-the-key (vs. multiple-choice/true-false where `isCorrect` carries that meaning) and there's real risk of getting the type list wrong under time pressure; safer to design deliberately than guess.

**Effort:** M
**Priority:** P1
**Depends on:** None — can run independently, but should be designed alongside the existing isCorrect-literalism entry above rather than as a separate patch

---

### Mark New Quizzes read-only in the course tree, not just in item detail

**What:** `CourseTree.tsx`'s `isReadOnly()` only checks `kind === 'file' || kind === 'opaque'` — it never looks at `quiz.readOnlyReason`. A New Quiz shows in the tree with no visual distinction from an editable quiz; the read-only banner only appears once you click into `ItemDetail`.

**Why:** A professor scanning the tree can't tell at a glance which quizzes are locked, undermining trust that "what looks editable is editable."

**Context:** Surfaced during `/plan-eng-review` outside-voice pass (2026-07-20), verified by reading `CourseTree.tsx:101-102`. Already-shipped code, not part of the #5-7 plan — a small, isolated fix (extend `isReadOnly` to also check the item's `quiz?.readOnlyReason`).

**Effort:** S
**Priority:** P2
**Depends on:** None
