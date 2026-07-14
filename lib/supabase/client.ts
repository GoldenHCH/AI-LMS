import { createClient } from '@supabase/supabase-js'

/**
 * Standalone Supabase client for the AI LMS project.
 *
 * Reads credentials from the environment (`.env`):
 *   - NEXT_PUBLIC_SUPABASE_URL       — the project API URL
 *   - NEXT_PUBLIC_SUPABASE_ANON_KEY  — the publishable (client-safe) key
 *
 * This is intentionally framework-agnostic. When the Next.js app is added,
 * swap this for `@supabase/ssr` browser/server clients — the env var names
 * above are already the Next.js convention, so nothing else needs to change.
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Set NEXT_PUBLIC_SUPABASE_URL and ' +
      'NEXT_PUBLIC_SUPABASE_ANON_KEY (see .env.example).',
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
