# AI LMS

AI-Native Course Editor for Canvas. See [MVP-Spec.md](MVP-Spec.md) and [Phase1-Issues.md](Phase1-Issues.md) for product scope.

## Canvas course import core

This repository contains the lossless import foundation for the Canvas course editor:

- LMS-agnostic `Course → Module → Item` model with pages, Classic/New quizzes, questions,
  answers, read-only files, and opaque unsupported items.
- Raw HTML and all Canvas IDs/positions preserved through a versioned JSON working copy.
- Read-only `canvasapi` import adapter plus raw New Quiz REST client.
- OAuth2 URL/token primitives with state validation and no token persistence in course files.
- Canvas-facing dry-run export snapshots and two independent round-trip fixtures.
- Live Classic/New Quiz write-back probes with safe restore behavior.

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

To exercise two real, isolated test courses without writing to them:

```bash
export CANVAS_BASE_URL=https://your-school.test.instructure.com
export CANVAS_ACCESS_TOKEN=your-test-token
export CANVAS_ROUNDTRIP_COURSE_IDS=123,456
python -m pytest -q -m live
```

The live import path issues reads only. New Quiz editing remains disabled unless the separate
write-back spike is deliberately run and accepted.

## Supabase connection

This repo is wired to the Supabase project **AI LMS** (`mlczrzmwtmmycmurjity`, region `ca-central-1`).

### Setup

1. Copy the environment template and confirm the values:
   ```bash
   cp .env.example .env   # .env already contains the project's URL + publishable key
   ```
   - `NEXT_PUBLIC_SUPABASE_URL` — the project API URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — the publishable (client-safe) key
   - `SUPABASE_SECRET_KEY` — server-only secret; add it yourself from Dashboard → Settings → API. **Never commit it.**

2. Install the client dependency:
   ```bash
   npm install
   ```

### Usage

```ts
import { supabase } from './lib/supabase/client.ts'

const { data, error } = await supabase.from('some_table').select('*')
```

The client in [lib/supabase/client.ts](lib/supabase/client.ts) is framework-agnostic. When the Next.js app lands, swap it for `@supabase/ssr` browser/server clients — the env var names already follow the Next.js convention, so nothing else changes.

### Verify the connection

```bash
npm run check:supabase
```

This creates a client from your `.env`, checks the auth endpoint, and pings the REST API. A successful run ends with `✓ Supabase connection verified.` (an empty auth session is expected — no user is signed in).
