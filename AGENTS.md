# AGENTS.md

Working context for building this product. Read this first every session.

## What we're building

An AI-native course editor for Canvas Cources — "Cursor for Canvas courses." A professor **imports** a Canvas course, tells an **agent** how they want it changed, **reviews** the proposed edits as diffs, and **exports** the changes back to Canvas.

See `MVP-Spec.md` (full PRD) and `Phase1-Issues.md` (build breakdown) in this folder. Those two files are the source of truth — this file is the quick orientation.

## The core bet (make product decisions against this)

The professor already knows *what* to change — they have intuition plus student feedback. Our value is **executing** those changes fast and consistently, not deciding what to change. So the whole product lives or dies on one thing:

> **Reviewing the agent's edits must be dramatically faster than making them by hand.**

If a change makes review slower or less trustworthy, it's wrong — even if it's technically clever. Optimize for fast, trustworthy review above almost everything else.

## Current phase: MVP (Phase 1)

In scope: **import → agent edit with reviewable diffs → export**, for Canvas **pages and quizzes only**.

Do NOT build these (they are later phases — don't let them creep in):
- Deciding *what* to change / recommendations
- Student interaction analytics ("PostHog for courses") — V2
- Editing uploaded files (PPTX, PDF, video) — opaque blobs, Future
- Automatic course-wide semantic dependency graph — Future
- Multi-professor collaboration, branching, non-Canvas LMS

If a request seems to pull toward one of these, flag it as out-of-MVP-scope before implementing.

## Non-negotiable constraints

- **Round-trip integrity is sacred.** Import → export with no edits must reproduce the original course exactly. Zero data loss, no broken quizzes, no scrambled formatting. Test this continuously.
- **Never silent-edit.** The agent proposes diffs; nothing writes to the working copy until the professor accepts, and nothing writes to Canvas until they confirm an export.
- **Quiz-answer safety.** Any change to a correct answer, point value, or question count must be flagged and require explicit confirmation before export. A silent grading error is the worst possible bug.
- **Import is non-destructive.** The source Canvas course is never modified on import.
- **Canvas write-back is a known risk.** New Quizzes vs. Classic Quizzes differ. Confirm write fidelity (Issue #1 spike) before assuming any quiz edit will export cleanly.

## Data model (keep it faithful and extensible)

- **Course** → **Modules** → **Items**
- **Item = Page** (rich text / HTML body) or **Quiz**
- **Quiz** → **Questions** → stem, options, correct answer(s), points
- Files (PPTX/PDF) are read-only context, not editable items.
- Leave an extension point for future item-to-item semantic links (slide ↔ reading ↔ exam). Don't implement it now, but don't design in a way that blocks it later.

## Build order (Phase 1)

1. `#1` Spike: Canvas quiz write-back fidelity — **blocks everything downstream**
2. `#2` Canvas OAuth + import, `#3` internal course model (lossless round-trip)
3. `#4` Module/item tree view
4. `#5` Agent chat → `#6` diffs → `#7` accept/reject/refine (sequential; diffs are the hard part)
5. `#8` Quiz-safety guardrails
6. `#9` Export with preview + confirm
7. `#10` Beta harness (measure editing-time reduction + acceptance rate)

## Validation gate before heavy build

Phase 0 is a concierge test: hand-produce one real professor's intended next-semester edits (no product) to confirm (a) the output clears their review bar and (b) "pages and quizzes only" covers enough of what they actually change. Don't over-invest in the Canvas integration until that's answered.

## Success metrics (what "working" means)

- ≥50% self-reported editing-time reduction vs. manual
- ≥70% of proposed edits accepted with no/trivial change
- 0 round-trip data-loss or broken-quiz incidents
- ≥3 professors complete a genuine update end-to-end and would use it again

## Tech stack

_Chosen incrementally — update as decisions land._

- **Database / backend:** **Supabase** (managed Postgres 17). Project `AI LMS` (`mlczrzmwtmmycmurjity`, region `ca-central-1`). Browser/session clients use `@supabase/ssr` with `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (temporary fallback to the old anon variable); Python persistence requires `SUPABASE_SECRET_KEY`. The live course schema is an owner-scoped relational mirror of the `canvas_import` model. Read-only RLS follows the complete hierarchy and requires both `auth.uid() = courses.owner_id` and an `aal2` MFA claim; browser roles cannot mutate rows. Partial import issues are stored in sanitized form, metadata-only audit events retain for three years, and a daily Cron job hard-deletes expired course trees and audit events. The Canvas PAT is never stored (only the normalized `canvas_base_url`). Generated types live in `lib/supabase/types.ts`; regenerate after schema changes.
- **App framework:** **Next.js 16 App Router** with **`@supabase/ssr`**. Invite-only email magic links and mandatory TOTP MFA protect the course list, course pages, connect flow, and Node-runtime import proxies.
- **Canvas import core:** Python 3.11+, `canvasapi` 3.6.0 for Classic resources,
  `requests` for New Quiz REST endpoints, LMS-agnostic dataclasses, and a versioned JSON MVP
  working copy. A service-token-protected FastAPI sidecar validates transient PATs, lists only active
  teacher/TA/designer courses, and performs synchronous GET-only imports. New Quiz write-back stays disabled until the live fidelity spike passes.
- **Still TBD:**
  - Agent / LLM layer — Codex (Anthropic API) is the working default; not formally locked.
  - Hosting / deploy — Vercel is the natural fit with Next.js; undecided.

**Commands**
- `npm install` — install dependencies
- `npm run check:supabase` — verify the Supabase connection (URL + key reachable)
- `pip install -r requirements-dev.txt` — install the Canvas core and test dependencies
- `python -m pytest -q` — run the offline lossless round-trip suite
- `python -m uvicorn canvas_import.service.app:app --app-dir backend --port 8000` — run the Canvas import sidecar

**Repo layout (so far)**
- `lib/supabase/client.ts` — configured Supabase client
- `lib/supabase/types.ts` — generated DB types (regenerate after migrations)
- `supabase/migrations/` — SQL schema migrations (source of truth for the DB)
- `scripts/check-supabase.mjs` — connection verification
- `canvas_import/model/` — LMS-agnostic course working-copy model
- `canvas_import/canvas/` — Canvas OAuth/import/New Quiz adapter boundary
- `spikes/quiz_writeback/` — explicit live fidelity probes
- `tests/roundtrip/` — offline and opt-in live round-trip gates
- `.env` / `.env.example` — Supabase credentials + template
- `MVP-Spec.md`, `Phase1-Issues.md` — PRD + Phase 1 build breakdown

## Conventions

- Prefer small, reviewable changes — mirror the product philosophy in the codebase.
- Every feature touching import/export needs a round-trip integrity test.
- When a task is ambiguous, ask rather than guess (same rule we give the agent).

## Imported Claude Cowork project instructions
