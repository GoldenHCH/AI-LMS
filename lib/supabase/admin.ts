import 'server-only'

import { createClient } from '@supabase/supabase-js'

import type { Database } from './types'

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const secretKey = process.env.SUPABASE_SECRET_KEY
  if (!url || !secretKey || secretKey.startsWith('sb_publishable_')) {
    throw new Error('Server-side Supabase access is not configured')
  }

  return createClient<Database>(url, secretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
