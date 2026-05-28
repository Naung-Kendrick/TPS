// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('PROJECT_URL') ?? '',
      Deno.env.get('ADMIN_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    )

    const { user_id } = await req.json()
    if (!user_id) throw new Error('user_id is required.')

    // 1. Look up the officer's real email from profiles
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('email')
      .eq('id', user_id)
      .single()

    if (profileError) throw new Error(`Profile not found: ${profileError.message}`)
    if (!profile?.email) throw new Error('No email address configured for this account. Ask your administrator to set your email in the system.')

    // 2. Generate a 6-digit numeric OTP
    const code = String(Math.floor(100000 + Math.random() * 900000))

    // 3. Store OTP in DB (expires in 10 minutes), replacing any existing
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()
    const { error: insertError } = await supabaseAdmin
      .from('otp_codes')
      .upsert({
        user_id,
        code,
        expires_at: expiresAt,
        used: false,
      }, { onConflict: 'user_id' })

    if (insertError) throw insertError

    // 4. Send email via Resend
    const resendKey = Deno.env.get('RESEND_API_KEY') ?? ''
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
            <div style="background: #1A1A1A; padding: 20px; text-align: center; margin-bottom: 24px;">
              <img src="https://tps-zeta.vercel.app/assets/logo.jpg" alt="IDTL Logo" width="64" height="64" style="border-radius: 50%; border: 2px solid #374151; margin-bottom: 12px; display: block; margin-left: auto; margin-right: auto;" />
              <h1 style="color: white; margin: 0; font-size: 18px; letter-spacing: 0.1em;">TPS AUTHENTICATION</h1>
              <p style="color: #A3A3A3; margin: 6px 0 0; font-size: 12px;">Immigration Department of Ta'ang Land</p>
            </div>
            <p style="color: #4B5563; font-size: 14px; margin-bottom: 8px;">
              Hello <strong>Officer</strong>,
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
              IDTL · Ta'ang Land Immigration Dept. · Confidential System
            </p>
            <p style="color: #9CA3AF; font-size: 10px; text-align: center; margin-top: 4px;">
              TPS by Mai Naung Naung &amp; Mai Nay Lin
            </p>
          </div>
        `,
      }),
    })

    if (!emailRes.ok) {
      const errBody = await emailRes.text()
      throw new Error(`Email send failed: ${errBody}`)
    }

    return new Response(
      JSON.stringify({ success: true, masked_email: maskEmail(profile.email) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error: any) {
    console.error('send-otp error:', error.message)
    return new Response(
      JSON.stringify({ error: error.message }),
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
