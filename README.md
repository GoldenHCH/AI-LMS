# AI LMS

AI-Native Course Editor for Canvas. See [MVP-Spec.md](MVP-Spec.md) and [Phase1-Issues.md](Phase1-Issues.md) for product scope.

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
