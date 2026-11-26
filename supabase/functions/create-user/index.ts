import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { checkOriginAndGetCors, enforcePostAndCors, requireVerifiedSystemAdmin } from "../_shared/security.ts"

const VALID_ROLES = new Set(['field', 'ops', 'regional', 'system'])
const VALID_ACCESS_LEVELS = new Set(['central', 'district', 'township', 'viewer', 'sub_township'])

serve(async (req) => {
  const { originAllowed, corsHeaders } = checkOriginAndGetCors(req)
  const guardResponse = enforcePostAndCors(req, originAllowed, corsHeaders)
  if (guardResponse) return guardResponse

  try {
    const supabaseUrl = Deno.env.get('PROJECT_URL') ?? Deno.env.get('SUPABASE_URL') ?? ''
    const serviceRoleKey = Deno.env.get('ADMIN_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Server configuration error.')
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    })

    // 1 & 2. Verify caller JWT, 12h Email OTP 2FA, and active System/Master Admin role
    const auth = await requireVerifiedSystemAdmin(
      req,
      supabaseAdmin,
      corsHeaders,
      'Forbidden: only active System Administrators can create accounts.'
    )
    if (auth.errorResponse) return auth.errorResponse

    // 3. Parse and validate input payload
    const { username, password, role, displayName, email, access_level, allowed_districts, allowed_townships } = await req.json()

    const cleanUsername = typeof username === 'string' ? username.trim().toLowerCase() : ''
    if (!cleanUsername || !/^[a-z0-9._-]{2,64}$/.test(cleanUsername)) {
      throw new Error('Username must be 2-64 characters using only letters, numbers, dots, underscores, or hyphens.')
    }

    if (typeof password !== 'string' || password.length < 8) {
      throw new Error('Password/PIN must be at least 8 characters.')
    }

    const cleanDisplayName = typeof displayName === 'string' && displayName.trim()
      ? displayName.trim().slice(0, 120)
      : cleanUsername

    if (!VALID_ROLES.has(role)) {
      throw new Error('Invalid role specified.')
    }

    const cleanLevel = access_level || 'central'
    if (!VALID_ACCESS_LEVELS.has(cleanLevel)) {
      throw new Error('Invalid access level specified.')
    }

    const cleanEmail = typeof email === 'string' ? email.trim() : ''
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      throw new Error('A valid OTP email address is required for every account.')
    }

    // 4. Create the user in Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: `${cleanUsername}@tps.idtl`,
      password: password,
      email_confirm: true,
      user_metadata: {
        full_name: cleanDisplayName,
      },
    })

    if (authError) throw authError

    // 5. Upsert profile with validated role & geographic scope
    const cleanDistricts = (cleanLevel !== 'central' && Array.isArray(allowed_districts))
      ? allowed_districts.filter((d) => typeof d === 'string' && d.trim() !== '')
      : []
    const cleanTownships = ((cleanLevel === 'township' || cleanLevel === 'sub_township') && Array.isArray(allowed_townships))
      ? allowed_townships.filter((t) => typeof t === 'string' && t.trim() !== '')
      : []

    const profilePayload: Record<string, unknown> = {
      id: authData.user.id,
      username: cleanUsername,
      display_name: cleanDisplayName,
      role: role,
      access_level: cleanLevel,
      allowed_districts: cleanDistricts,
      allowed_townships: cleanTownships,
      email: cleanEmail,
    }

    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert(profilePayload, { onConflict: 'id' })

    if (profileError) {
      // Rollback auth user so no orphan account remains without a profile
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id).catch(() => {})
      throw profileError
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'User created successfully!',
        user: { id: authData.user.id, username: cleanUsername },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error: unknown) {
    const errMsg = error instanceof Error
      ? error.message
      : (typeof error === 'object' && error !== null && 'message' in error && typeof (error as { message?: unknown }).message === 'string')
        ? (error as { message: string }).message
        : 'Failed to create user.'
    console.error('create-user error:', errMsg)
    return new Response(
      JSON.stringify({ error: errMsg }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
