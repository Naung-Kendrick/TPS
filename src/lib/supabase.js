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
