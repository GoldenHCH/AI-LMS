import 'server-only'

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

import type { Database } from '@/lib/supabase/types'

import { getSupabaseBrowserCredentials } from './env'

export async function createClient() {
  const cookieStore = await cookies()
  const { url, publishableKey } = getSupabaseBrowserCredentials()

  return createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          )
        } catch {
          // Server Components cannot write cookies; proxy.ts owns refresh.
        }
      },
    },
  })
}
