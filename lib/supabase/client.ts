import { createBrowserClient } from '@supabase/ssr'

import type { Database } from '@/lib/supabase/types'

import { getSupabaseBrowserCredentials } from './env'

export function createClient() {
  const { url, publishableKey } = getSupabaseBrowserCredentials()
  return createBrowserClient<Database>(url, publishableKey)
}
