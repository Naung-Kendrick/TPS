import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Check your .env file or Vercel settings.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

/**
 * Verifies an officer's password/PIN in an isolated, non-persisted Supabase
 * client so the active 2FA-verified session in localStorage is never overwritten.
 */
export async function verifyOfficerPassword(email, password) {
  if (!email || !password) {
    return { error: new Error('Missing credentials.') }
  }
  const ephemeralClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })
  const { error } = await ephemeralClient.auth.signInWithPassword({ email, password })
  if (!error) {
    await ephemeralClient.auth.signOut().catch(() => {})
  }
  return { error }
}

/**
 * Fetches all rows across PostgREST `.range()` pages so queries never truncate
 * at PostgREST's 1,000-row default cap. `buildQuery` must return a fresh
 * ordered query (including a unique tie-breaker such as `.order('id')`).
 */
export async function fetchAllRows(buildQuery, pageSize = 1000) {
  const rows = []
  let from = 0
  while (true) {
    const { data, error } = await buildQuery().range(from, from + pageSize - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    rows.push(...data)
    if (data.length < pageSize) break
    from += pageSize
  }
  return rows
}
