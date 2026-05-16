// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create Supabase Admin Client using SERVICE_ROLE_KEY
    const supabaseAdmin = createClient(
      Deno.env.get('PROJECT_URL') ?? '',
      Deno.env.get('ADMIN_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    )

    // Receive data from React frontend
    const { username, password, role, displayName } = await req.json()

    if (!username || !password || !role) {
      throw new Error('Username, password, and role are required.')
    }

    // 1. Create the user in Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: `${username}@tps.idtl`,
      password: password,
      email_confirm: true,
      user_metadata: {
        full_name: displayName
      }
    })

    if (authError) throw authError

    // 2. Update the profile
    // Note: A trigger usually creates a profile automatically. We update it with specific details.
    // We use upsert to be safe.
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: authData.user.id,
        username: username,
        display_name: displayName,
        role: role, // 'field', 'ops', 'regional', 'system' (or 'staff', 'admin', 'master')
      }, { onConflict: 'id' })

    if (profileError) throw profileError

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'User created successfully!',
        user: { id: authData.user.id, username } 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error: any) {
    console.error('Edge Function Error:', error.message)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
