import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

function checkOriginAndGetCors(req: Request) {
  const allowedEnv = Deno.env.get('ALLOWED_ORIGIN') ?? ''
  const requestOrigin = req.headers.get('origin') ?? ''
  let allowOrigin = '*'
  let originAllowed = true

  if (allowedEnv.trim() !== '') {
    const allowedList = allowedEnv.split(',').map((s) => s.trim()).filter(Boolean)
    const isTpsVercelOrigin = /^https:\/\/tps(?:-zeta|-naung-naungs-projects-f5910407|-git-[a-z0-9-]+-naung-naungs-projects-f5910407|-[a-z0-9]+-naung-naungs-projects-f5910407)\.vercel\.app$/.test(requestOrigin)
    const matched = allowedList.includes(requestOrigin) || (allowedList.some((o) => o.endsWith('.vercel.app')) && isTpsVercelOrigin)
    if (requestOrigin && !matched) {
      originAllowed = false
    }
    allowOrigin = matched ? requestOrigin : allowedList[0]
  }

  return {
    originAllowed,
    corsHeaders: {
      'Access-Control-Allow-Origin': allowOrigin,
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-retry-count, x-region',
      'Vary': 'Origin',
    },
  }
}

async function hashOtp(userId: string, code: string, secret: string): Promise<string> {
  const data = new TextEncoder().encode(`${userId}:${code}:${secret}`)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

function extractSessionIdFromJwt(jwt: string): string | null {
  try {
    const parts = jwt.split('.')
    if (parts.length !== 3) return null
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=')
    const payload = JSON.parse(atob(padded))
    return typeof payload?.session_id === 'string' && payload.session_id ? payload.session_id : null
  } catch {
    return null
  }
}

serve(async (req) => {
  const { originAllowed, corsHeaders } = checkOriginAndGetCors(req)

  if (req.method === 'OPTIONS') {
    if (!originAllowed) {
      return new Response('Forbidden origin', { status: 403, headers: corsHeaders })
    }
    return new Response('ok', { headers: corsHeaders })
  }

  if (!originAllowed) {
    return new Response(
      JSON.stringify({ error: 'Forbidden: origin not allowed.' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
    )
  }

  try {
    const supabaseUrl = Deno.env.get('PROJECT_URL') ?? Deno.env.get('SUPABASE_URL') ?? ''
    const serviceRoleKey = Deno.env.get('ADMIN_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Server configuration error.')
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    })

    // 1. Verify caller JWT
    const authHeader = req.headers.get('Authorization') ?? ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : ''
    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: missing authorization token.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      )
    }

    const { data: { user: authUser }, error: authErr } = await supabaseAdmin.auth.getUser(token)
    if (authErr || !authUser) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: invalid or expired session.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      )
    }

    const sessionId = extractSessionIdFromJwt(token)
    if (!sessionId) {
      return new Response(
        JSON.stringify({ error: 'Invalid session token.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      )
    }

    const { user_id: bodyUserId, code } = await req.json()
    if (bodyUserId && bodyUserId !== authUser.id) {
      return new Response(
        JSON.stringify({ error: 'Forbidden: user mismatch.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      )
    }

    const userId = authUser.id
    const trimmedCode = typeof code === 'string' ? code.trim() : ''
    if (!/^\d{6}$/.test(trimmedCode)) {
      throw new Error('Verification code must be 6 digits.')
    }

    // 2. Verify active status before checking OTP
    const { data: profile, error: profErr } = await supabaseAdmin
      .from('profiles')
      .select('is_active')
      .eq('id', userId)
      .single()

    if (profErr || !profile || profile.is_active === false) {
      return new Response(
        JSON.stringify({ error: 'Account deactivated — contact your administrator.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      )
    }

    // 3. Atomically verify OTP hash, increment attempts under row lock, mark used & record 2FA session
    const otpSecret = Deno.env.get('OTP_HMAC_SECRET')?.trim() ?? ''
    if (!otpSecret) {
      throw new Error('Server configuration error.')
    }
    const candidateHash = await hashOtp(userId, trimmedCode, otpSecret)

    const { data: rpcRes, error: rpcErr } = await supabaseAdmin.rpc('verify_and_consume_otp', {
      p_user_id: userId,
      p_code_hash: candidateHash,
      p_session_id: sessionId,
    })

    if (rpcErr || !rpcRes) {
      console.error('verify_and_consume_otp error:', rpcErr?.message)
      throw new Error('Failed to finalize verification session.')
    }

    if (!rpcRes.ok) {
      switch (rpcRes.status) {
        case 'no_otp':
          throw new Error('No OTP found. Please request a new code.')
        case 'expired':
          throw new Error('Code has expired. Please request a new one.')
        case 'used':
          throw new Error('Code already used. Please request a new one.')
        case 'locked':
          throw new Error('Too many failed attempts. Please request a new code.')
        case 'mismatch': {
          const left = typeof rpcRes.remaining_attempts === 'number' ? rpcRes.remaining_attempts : 0
          throw new Error(`Incorrect code. ${left} attempt(s) remaining.`)
        }
        default:
          throw new Error('Verification failed.')
      }
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error: unknown) {
    const errMsg = error instanceof Error
      ? error.message
      : (typeof error === 'object' && error !== null && 'message' in error && typeof (error as { message?: unknown }).message === 'string')
        ? (error as { message: string }).message
        : 'Verification failed.'
    console.error('verify-otp error:', errMsg)
    return new Response(
      JSON.stringify({ error: errMsg }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
