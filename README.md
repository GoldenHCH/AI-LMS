# AI LMS

AI-Native Course Editor for Canvas. See [MVP-Spec.md](MVP-Spec.md) and [Phase1-Issues.md](Phase1-Issues.md) for product scope.

## Canvas course import core

This repository contains the lossless import foundation for the Canvas course editor:

- LMS-agnostic `Course → Module → Item` model with pages, Classic/New quizzes, questions,
  answers, read-only files, and opaque unsupported items.
- Raw HTML and all Canvas IDs/positions preserved through a versioned JSON working copy.
- Read-only `canvasapi` import adapter plus raw New Quiz REST client behind a protected FastAPI sidecar.
- Transient Canvas URL/PAT connect flow; credentials are never persisted in environment files,
  browser storage, cookies, Supabase, logs, or working-copy files.
- Imported courses live in isolated, signed-cookie workspaces for exactly 30 minutes; browser
  roles have no direct course-table access and expired trees are cascade-deleted by Cron.
- Canvas-facing dry-run export snapshots and two independent round-trip fixtures.
- Live Classic/New Quiz write-back probes with safe restore behavior.

## Transient workspace contract

1. `/` always renders a blank Canvas URL and masked-token form. It never lists prior imports.
2. The URL and PAT remain only in transient form/request memory while Canvas credentials are
   validated and an instructor-manageable course is selected.
3. A successful import receives a random `workspace_id`. After Canvas retrieval succeeds and
   immediately before persistence, the trusted sidecar sets `expires_at` to 30 minutes later;
   activity never extends it.
4. The browser receives a signed `HttpOnly`, `Secure`, `SameSite=Strict` cookie containing only
   the workspace UUID and fixed deadline. It contains no Canvas credentials or course ID.
5. Every course read is server-side and must match `course.id`, `workspace_id`, and an unexpired
   `expires_at`. Missing, forged, expired, and cross-workspace cookies redirect to `/`.
6. The course UI shows the remaining time, clears course content at expiry, and redirects to `/`.
   **Disconnect and delete** immediately cascade-deletes the workspace and clears the cookie.
7. Expired rows are inaccessible at the deadline and physically cascade-deleted by a Supabase
   Cron job that runs every minute.

Future Canvas export must ask for a fresh Canvas URL and PAT because neither credential is retained.

Course working copies may preserve Canvas-provided HTML and raw payload URLs required for lossless
round-trip. The dedicated Canvas base URL and PAT are not stored. This phase does not request or
import enrollments, submissions, grades, analytics, or student identifiers.

## Development

### Python setup

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt
python -m pytest -q
```

The normal test suite is completely offline. See
[`backend/spikes/quiz_writeback/README.md`](backend/spikes/quiz_writeback/README.md) for the credentialed live
spike and [`docs/COURSE_MODEL.md`](docs/COURSE_MODEL.md) for the model contract.

### Live round-trip gate

To exercise two real, isolated test courses without writing to them, run the interactive gate.
It prompts without storing the Canvas URL, token, or course IDs:

```bash
python backend/scripts/verify_live_roundtrip.py
```

The live import path issues reads only. New Quiz editing remains disabled unless the separate
write-back spike is deliberately run and accepted.

## Supabase connection

This repo is wired to the Supabase project **AI LMS** (`mlczrzmwtmmycmurjity`, region `ca-central-1`).

### Setup

1. Copy the environment template and add infrastructure credentials only:
   ```bash
   cp .env.example .env
   ```
   - `NEXT_PUBLIC_SUPABASE_URL` — the project API URL
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — used by the connection health check; it has no
     course-table privileges
   - `SUPABASE_SECRET_KEY` — server-only secret; add it yourself from Dashboard → Settings → API. **Never commit it.**
   - `CANVAS_IMPORT_SERVICE_TOKEN` — high-entropy shared secret used only between Next.js and the sidecar
   - `CANVAS_IMPORT_SERVICE_URL` — the FastAPI sidecar origin
   - `CANVAS_ALLOWED_HOSTS` — optional comma-separated exact self-hosted Canvas domains

   Do not add `CANVAS_BASE_URL`, `CANVAS_ACCESS_TOKEN`, saved course IDs, or fixture URLs. Canvas
   user credentials are entered manually for each new browser session.

2. Install the client dependency:
   ```bash
   npm install
   ```

### Run the app and import sidecar

```bash
python -m uvicorn canvas_import.service.app:app --app-dir backend --port 8000
npm run dev
```

Opening `/` always shows the blank connection form, including when a workspace cookie exists.
Course reads and writes use the server secret key; RLS and revoked grants block `anon` and
`authenticated` from every course-content table.

### Verify the connection

```bash
npm run check:supabase
```

This creates a client from your `.env`, checks the auth endpoint, and pings the REST API. A successful run ends with `✓ Supabase connection verified.` (an empty auth session is expected — no user is signed in).

## Verification

```bash
npm run typecheck
npm run build
npm run test:web
python -m pytest -q
```

The web tests cover signed-cookie round-trip, tampering, exact expiry, and absence of Canvas
credentials in the cookie payload. The Python suite covers lossless persistence, workspace-scoped
replacement, expiry persistence, and service request handling.

With the app running on `http://localhost:3000` and the live Supabase variables configured:

```bash
npm run test:workspace-live
```

This opt-in test creates two synthetic empty course rows, verifies blank-root, refresh,
no-cookie, forged, expired, and cross-workspace behavior, exercises Disconnect, and deletes its
test rows in `finally`. Do not point it at an environment where synthetic rows are prohibited.

The live database migrations in `supabase/migrations/` delete legacy imports, remove stored
Canvas/owner columns, require workspace isolation, revoke browser access, and schedule one-minute
expiry cleanup. Generated schema types live in `lib/supabase/types.ts`.
