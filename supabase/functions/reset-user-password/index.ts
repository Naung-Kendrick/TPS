import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { checkOriginAndGetCors, enforcePostAndCors, requireVerifiedSystemAdmin } from "../_shared/security.ts"

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

serve(async (req) => {
  const { originAllowed, corsHeaders } = checkOriginAndGetCors(req)
  const guardResponse = enforcePostAndCors(req, originAllowed, corsHeaders)
  if (guardResponse) return guardResponse

  const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' }

  try {
    const supabaseUrl = Deno.env.get('PROJECT_URL') ?? Deno.env.get('SUPABASE_URL') ?? ''
    const serviceRoleKey = Deno.env.get('ADMIN_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Server configuration error.')
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    })

    // 1. Verify caller JWT, active 12h 2FA session, and active system/master role
    const auth = await requireVerifiedSystemAdmin(
      req,
      supabaseAdmin,
      corsHeaders,
      'Forbidden: only active System Administrators can reset user passwords.'
    )
    if (auth.errorResponse) return auth.errorResponse
    const caller = auth.caller!
    const callerProfile = auth.callerProfile!

    // 2. Parse & validate targetUserId + newPassword
    const body = await req.json()
    const targetUserId = typeof body?.targetUserId === 'string' ? body.targetUserId.trim() : ''
    const newPassword = typeof body?.newPassword === 'string' ? body.newPassword : ''

    if (!UUID_REGEX.test(targetUserId)) {
      throw new Error('Invalid target user ID.')
    }
    if (targetUserId === caller.id) {
      return new Response(
        JSON.stringify({ error: 'Forbidden: administrators cannot reset their own password via this endpoint.' }),
        { headers: jsonHeaders, status: 403 }
      )
    }
    if (newPassword.trim().length < 8 || newPassword.length < 8 || newPassword.length > 128) {
      throw new Error('New Password/PIN must be 8-128 non-whitespace characters.')
    }

    // 3. Look up target account & enforce privilege boundary (non-master cannot reset master)
    const { data: targetProfile, error: targetErr } = await supabaseAdmin
      .from('profiles')
      .select('id, username, role, is_active')
      .eq('id', targetUserId)
      .single()

    if (targetErr || !targetProfile) {
      return new Response(
        JSON.stringify({ error: 'Target account profile not found.' }),
        { headers: jsonHeaders, status: 404 }
      )
    }

    if (targetProfile.role === 'master' && callerProfile.role !== 'master') {
      return new Response(
        JSON.stringify({ error: 'Forbidden: only a Master Administrator can reset a Master account.' }),
        { headers: jsonHeaders, status: 403 }
      )
    }

    // 4. Update Auth password/PIN
    const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(targetUserId, {
      password: newPassword,
    })
    if (updateErr) throw new Error('Failed to update user password.')

    // 5. Revoke active 2FA sessions & pending OTPs so target must complete fresh login + 2FA
    try {
      await supabaseAdmin.from('verified_2fa_sessions').delete().eq('user_id', targetUserId)
    } catch {
      // Best-effort revocation
    }
    try {
      await supabaseAdmin.from('otp_codes').delete().eq('user_id', targetUserId)
    } catch {
      // Best-effort OTP invalidation
    }

    // 6. Write immutable audit record (never store credential values)
    try {
      await supabaseAdmin.from('audit_logs').insert([{
        user_id: caller.id,
        action: 'ADMIN_RESET_PASSWORD',
        table_name: 'profiles',
        details: {
          target_user_id: targetUserId,
          target_username: targetProfile.username || null,
          performed_by: callerProfile.username || caller.id,
          timestamp: new Date().toISOString(),
        },
      }])
    } catch {
      // Do not fail completed reset if audit insert encounters transient error
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Password/PIN reset successfully. The user must log in and verify Email OTP again.',
      }),
      { headers: jsonHeaders, status: 200 }
    )
  } catch (error: unknown) {
    const errMsg = error instanceof Error
      ? error.message
      : (typeof error === 'object' && error !== null && 'message' in error && typeof (error as { message?: unknown }).message === 'string')
        ? (error as { message: string }).message
        : 'Failed to reset user password.'
    console.error('reset-user-password error:', errMsg)
    return new Response(
      JSON.stringify({ error: errMsg }),
      { headers: jsonHeaders, status: 400 }
    )
  }
})
