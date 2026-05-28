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

    const { user_id, code } = await req.json()
    if (!user_id || !code) throw new Error('user_id and code are required.')

    // 1. Fetch the stored OTP
    const { data: otpRow, error: fetchError } = await supabaseAdmin
      .from('otp_codes')
      .select('code, expires_at, used, attempts')
      .eq('user_id', user_id)
      .single()

    if (fetchError || !otpRow) throw new Error('No OTP found. Please request a new code.')

    // 2. Check expiry
    if (new Date(otpRow.expires_at) < new Date()) {
      throw new Error('Code has expired. Please request a new one.')
    }

    // 3. Check already used
    if (otpRow.used) {
      throw new Error('Code already used. Please request a new one.')
    }

    // 4. Check attempt limit (max 5)
    const attempts = (otpRow.attempts || 0) + 1
    if (attempts > 5) {
      throw new Error('Too many failed attempts. Please request a new code.')
    }

    // 5. Verify code
    if (otpRow.code !== code.trim()) {
      // Increment attempts
      await supabaseAdmin
        .from('otp_codes')
        .update({ attempts })
        .eq('user_id', user_id)
      throw new Error(`Incorrect code. ${5 - attempts} attempt(s) remaining.`)
    }

    // 6. Mark as used
    await supabaseAdmin
      .from('otp_codes')
      .update({ used: true })
      .eq('user_id', user_id)

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error: any) {
    console.error('verify-otp error:', error.message)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
