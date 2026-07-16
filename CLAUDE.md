# CLAUDE.md

Working context for building this product. Read this first every session.

## What we're building

An AI-native course editor for Canvas courses — "Cursor for Canvas courses." A professor **imports** a Canvas course, tells an **agent** how they want it changed, **reviews** the proposed edits as diffs, and **exports** the result as a **brand-new Canvas course** (the original is never touched). Export is via a Common Cartridge (`.imscc`) file the professor uploads to Canvas — no course-creation API permissions and no write API against the live course.

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

- **Round-trip integrity is sacred.** Import → export with no edits must produce a new Canvas course that reproduces the original exactly. Zero data loss, no broken quizzes, no scrambled formatting. Test this continuously.
- **Never silent-edit.** The agent proposes diffs; nothing writes to the working copy until the professor accepts, and nothing leaves the workspace until they confirm an export.
- **Export creates a new course; the source is never mutated.** Export produces a Common Cartridge the professor imports into Canvas as a fresh course. We never PATCH the live course, so a silent change to an enrolled-student gradebook is impossible by construction.
- **Quiz-answer safety.** Any change to a correct answer, point value, or question count must still be flagged in review — the professor is trusting the exported answer keys. Because the export lands in a student-less new course, this is a review flag, not a live-grading gate.
- **Import is non-destructive.** The source Canvas course is never modified on import.
- **Common Cartridge fidelity is a known risk.** Canvas's `.imscc` importer builds the quizzes; it tends to import New Quizzes as Classic. Confirm new-course fidelity (Issue #1 spike) before assuming any quiz exports cleanly.
- **Canvas credentials are request-local.** Never store the entered Canvas URL or PAT in environment
  files, cookies, browser storage, URLs, logs, Supabase columns, fixtures, or working-copy files.
- **Workspace expiry is fixed.** A successful import creates one random workspace with a deadline
  exactly 30 minutes later. Activity must not extend it; expiry or Disconnect removes access.
- **Anonymous isolation is mandatory.** Course reads are server-only and must match course ID,
  workspace ID, and expiry. Browser Supabase roles must have no course-content privileges.

## Data model (keep it faithful and extensible)

- **Course** → **Modules** → **Items**
- **Item = Page** (rich text / HTML body) or **Quiz**
- **Quiz** → **Questions** → stem, options, correct answer(s), points
- Files (PPTX/PDF) are read-only context, not editable items.
- Leave an extension point for future item-to-item semantic links (slide ↔ reading ↔ exam). Don't implement it now, but don't design in a way that blocks it later.

## Build order (Phase 1)

1. `#1` Spike: Canvas quiz write-back fidelity — **blocks everything downstream**
2. `#2` Manual Canvas URL/PAT import, `#3` internal course model (lossless round-trip). OAuth is deferred.
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

- **Database / backend:** **Supabase** (managed Postgres 17). Project `AI LMS` (`mlczrzmwtmmycmurjity`, region `ca-central-1`). Course reads and writes are server-only through `SUPABASE_SECRET_KEY`; RLS is enabled and all privileges are revoked from `anon` and `authenticated` on every course-content table. Imported trees are isolated by required random workspace UUIDs. They become inaccessible exactly 30 minutes after successful import and cascade-delete through a one-minute Cron job. The schema has no Canvas base URL, PAT, or legacy owner column. Generated types live in `lib/supabase/types.ts`; regenerate after schema changes.
- **App framework:** **Next.js 16 App Router**. `/` is always a blank manual Canvas URL/PAT form. The active course route requires a signed `HttpOnly`, `Secure`, `SameSite=Strict` workspace cookie containing only a workspace UUID and fixed expiry. The course UI clears at expiry; Disconnect deletes immediately.
- **Canvas import core:** Python 3.11+, `canvasapi` 3.6.0 for Classic resources,
  `requests` for New Quiz REST endpoints, LMS-agnostic dataclasses, and a versioned JSON MVP
  working copy. New Quiz write-back stays disabled until the live fidelity spike passes.
- **Still TBD:**
  - Agent / LLM layer — Claude (Anthropic API) is the working default; not formally locked.
  - Hosting / deploy — Vercel is the natural fit with Next.js; undecided.

**Commands**
- `npm install` — install dependencies
- `npm run check:supabase` — verify the Supabase connection (URL + key reachable)
- `npm run typecheck` — run TypeScript checks
- `npm run build` — run the production Next.js build
- `npm run test:web` — run offline workspace-cookie tests
- `npm run test:workspace-live` — opt-in live isolation/expiry/disconnect test; requires the app and live Supabase configuration
- `pip install -r requirements-dev.txt` — install the Canvas core and test dependencies
- `python -m pytest -q` — run the offline lossless round-trip suite
- `python backend/scripts/verify_live_roundtrip.py` — interactive, GET-only live Canvas round-trip gate
- `python -m uvicorn canvas_import.service.app:app --app-dir backend --port 8000` — run the import sidecar

**Repo layout (so far)**
- `app/api/canvas/import/route.ts` — creates trusted workspace IDs and sets the signed cookie
- `app/api/workspace/disconnect/route.ts` — deletes the active workspace and clears its cookie
- `lib/workspaces/` — workspace signing, cookie parsing, and server-only deletion
- `lib/supabase/admin.ts` — server-only Supabase secret client; there is no browser database client
- `lib/supabase/types.ts` — generated DB types (regenerate after migrations)
- `supabase/migrations/` — SQL schema migrations (source of truth for the DB)
- `scripts/check-supabase.mjs` — connection verification
- `backend/canvas_import/model/` — LMS-agnostic course working-copy model
- `backend/canvas_import/canvas/` — Canvas import/New Quiz adapter boundary
- `backend/canvas_import/service/` — service-token-protected request-local import sidecar
- `backend/spikes/quiz_writeback/` — explicit live fidelity probes
- `backend/tests/roundtrip/` — offline persistence and round-trip gates
- `tests/web/` — offline signed-session tests and opt-in live workspace isolation test
- `.env` / `.env.example` — infrastructure credentials only; never Canvas user credentials
- `MVP-Spec.md`, `Phase1-Issues.md` — PRD + Phase 1 build breakdown

## Transient workspace implementation

- `POST /api/canvas/import` ignores browser-supplied workspace fields, generates a UUID, forwards
  it to the trusted sidecar, and returns only `courseUuid`, `partial`, and `expiresAt`.
- The sidecar starts the 30-minute clock only after Canvas retrieval succeeds and immediately
  before persistence. The deadline is stored on the course row and never refreshed.
- Course Server Components scope reads by both course UUID and workspace UUID and reject rows
  where `expires_at <= now()`.
- The cookie is HMAC-signed with a domain-separated server key. Forged or expired cookies decode
  to no session and redirect to `/`.
- Supabase Cron physically deletes expired course trees every minute; foreign keys cascade through
  modules, items, pages, quizzes, questions, answers, and files.
- Future Canvas export must request a fresh URL and PAT.

## Data and compliance boundary

- Current imports contain instructor-authored course content and quiz answer keys, but no
  enrollments, submissions, grades, attendance, analytics, profiles, or student identifiers.
- Raw Canvas payloads and file/content URLs may be retained for the 30-minute lossless working
  copy. Do not add unrelated identity, device, location, analytics, or advertising fields.
- No AI/ML processing occurs in the import phase. Before real school data flows, complete the
  applicable DPA and sub-processor review. Never use course or student data for model training.
- Preserve accessible labels, keyboard operation, focus management, and 44px targets in all
  connection, timer, error, and destructive-action UI.

## Conventions

- Prefer small, reviewable changes — mirror the product philosophy in the codebase.
- Every feature touching import/export needs a round-trip integrity test.
- When a task is ambiguous, ask rather than guess (same rule we give the agent).
