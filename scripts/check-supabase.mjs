// Lightweight connectivity check for the Supabase project.
// Run with: npm run check:supabase   (loads .env via `node --env-file`)

import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!url || !key) {
  console.error('✗ Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (see .env.example)')
  process.exit(1)
}

// 1) Confirm the client library is installed and constructs.
const supabase = createClient(url, key)
console.log(`• Client created for ${url}`)

// 2) Confirm the auth endpoint is reachable (empty session is expected — nobody is signed in).
const { error: authError } = await supabase.auth.getSession()
if (authError) {
  console.error('✗ auth.getSession() returned an error:', authError.message)
  process.exit(1)
}
console.log('• auth.getSession() OK (no active session, as expected)')

// 3) Prove URL + key reach the project by calling the auth health endpoint
//    (accepts the publishable key; the /rest/v1/ schema root requires a secret key).
const res = await fetch(`${url}/auth/v1/health`, { headers: { apikey: key } })
if (!res.ok) {
  console.error(`✗ Health endpoint returned HTTP ${res.status} ${res.statusText} — check the URL and key.`)
  process.exit(1)
}
console.log(`• Auth health endpoint reachable (HTTP ${res.status})`)

console.log('\n✓ Supabase connection verified.')
