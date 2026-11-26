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

function generateSecureOtp(): string {
  // Rejection sampling in [0, 900000) to avoid modulo bias
  const limit = Math.floor(0x100000000 / 900000) * 900000
  const buf = new Uint32Array(1)
  while (true) {
    crypto.getRandomValues(buf)
    if (buf[0] < limit) {
      return String(100000 + (buf[0] % 900000))
    }
  }
}

async function hashOtp(userId: string, code: string, secret: string): Promise<string> {
  const data = new TextEncoder().encode(`${userId}:${code}:${secret}`)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('')
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

    // Bind OTP request strictly to the authenticated caller
    let bodyUserId: string | undefined
    try {
      const body = await req.json()
      bodyUserId = body?.user_id
    } catch {
      // Allow empty body if caller relies strictly on JWT
    }
    if (bodyUserId && bodyUserId !== authUser.id) {
      return new Response(
        JSON.stringify({ error: 'Forbidden: user mismatch.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      )
    }

    const userId = authUser.id

    // 2. Look up the officer's email & active state from profiles
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('email, is_active')
      .eq('id', userId)
      .single()

    if (profileError || !profile) {
      throw new Error('Account profile not found.')
    }
    if (profile.is_active === false) {
      return new Response(
        JSON.stringify({ error: 'Account deactivated — contact your administrator.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      )
    }
    if (!profile.email) {
      throw new Error('No email address configured for this account. Ask your administrator to set your email in the system.')
    }

    // 3. Server-side resend cooldown (55 seconds)
    const { data: existingOtp } = await supabaseAdmin
      .from('otp_codes')
      .select('created_at, used')
      .eq('user_id', userId)
      .maybeSingle()

    if (existingOtp && !existingOtp.used && existingOtp.created_at) {
      const elapsedMs = Date.now() - new Date(existingOtp.created_at).getTime()
      if (elapsedMs < 55_000) {
        const waitSec = Math.ceil((55_000 - elapsedMs) / 1000)
        return new Response(
          JSON.stringify({ error: `Please wait ${waitSec}s before requesting a new code.` }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 429 }
        )
      }
    }

    // 4. Generate cryptographically secure 6-digit OTP and hash before storing
    const otpSecret = Deno.env.get('OTP_HMAC_SECRET')?.trim() ?? ''
    if (!otpSecret) {
      throw new Error('Server configuration error.')
    }
    const code = generateSecureOtp()
    const codeHash = await hashOtp(userId, code, otpSecret)

    const nowIso = new Date().toISOString()
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()
    const { error: insertError } = await supabaseAdmin
      .from('otp_codes')
      .upsert({
        user_id: userId,
        code: codeHash,
        expires_at: expiresAt,
        used: false,
        attempts: 0,
        created_at: nowIso,
      }, { onConflict: 'user_id' })

    if (insertError) throw new Error('Could not generate verification code.')

    // 5. Send email via Resend
    const resendKey = Deno.env.get('RESEND_API_KEY') ?? ''
    if (!resendKey) {
      throw new Error('Email delivery service is not configured.')
    }
    const fromEmail = Deno.env.get('OTP_FROM_EMAIL') ?? 'noreply@taanglandimmigration.org'

    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `TPS System <${fromEmail}>`,
        to: [profile.email],
        subject: 'TPS Login Verification Code',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
            <div style="background: #1A1A1A; padding: 28px 20px; text-align: center; margin-bottom: 24px;">
              <h1 style="color: white; margin: 0; font-size: 18px; letter-spacing: 0.1em; font-weight: 700;">TPS AUTHENTICATION</h1>
              <p style="color: #A3A3A3; margin: 8px 0 0; font-size: 12px;">Immigration Department of Ta'ang Land</p>
            </div>
            <p style="color: #4B5563; font-size: 14px; margin-bottom: 8px;">
              Hello <strong>Immigration Officer</strong>,
            </p>
            <p style="color: #4B5563; font-size: 14px; margin-bottom: 24px;">
              Your one-time login verification code is:
            </p>
            <div style="background: #F9FAFB; border: 2px solid #1A1A1A; padding: 24px; text-align: center; margin-bottom: 24px;">
              <span style="font-family: monospace; font-size: 40px; font-weight: 900; letter-spacing: 0.4em; color: #1A1A1A;">${code}</span>
            </div>
            <p style="color: #6B7280; font-size: 12px; margin-bottom: 4px;">
              ⏱ This code expires in <strong>10 minutes</strong>.
            </p>
            <p style="color: #6B7280; font-size: 12px;">
              If you did not attempt to log in, please contact your administrator immediately.
            </p>
            <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 24px 0;" />
            <p style="color: #9CA3AF; font-size: 10px; text-align: center;">
              IDTL · Ta'ang Land Immigration Dept. · Confidential System . Powered By Mai Naung Naung & Mai Nay Lin
            </p>
          </div>
        `,
      }),
    })

    if (!emailRes.ok) {
      const errBody = await emailRes.text()
      console.error('Resend API error:', errBody)
      throw new Error('Failed to deliver verification email. Please try again.')
    }

    return new Response(
      JSON.stringify({ success: true, masked_email: maskEmail(profile.email) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error: unknown) {
    const errMsg = error instanceof Error
      ? error.message
      : (typeof error === 'object' && error !== null && 'message' in error && typeof (error as { message?: unknown }).message === 'string')
        ? (error as { message: string }).message
        : 'Failed to send verification code.'
    console.error('send-otp error:', errMsg)
    return new Response(
      JSON.stringify({ error: errMsg }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})

function maskEmail(email: string): string {
  const [user, domain] = email.split('@')
  if (!domain) return email
  const visible = user.slice(0, 2)
  return `${visible}${'*'.repeat(Math.max(user.length - 2, 2))}@${domain}`
}
