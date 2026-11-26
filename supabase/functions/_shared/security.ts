const ALLOWED_HEADERS = 'authorization, x-client-info, apikey, content-type, x-retry-count, x-region'

/**
 * Validates the request Origin against the `ALLOWED_ORIGIN` allowlist.
 * Fails closed when `ALLOWED_ORIGIN` is unset/empty instead of emitting `*`.
 */
export function checkOriginAndGetCors(req: Request) {
  const allowedEnv = (Deno.env.get('ALLOWED_ORIGIN') ?? '').trim()
  const requestOrigin = req.headers.get('origin') ?? ''

  if (!allowedEnv) {
    return {
      originAllowed: false,
      corsHeaders: {
        'Access-Control-Allow-Origin': 'null',
        'Access-Control-Allow-Headers': ALLOWED_HEADERS,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Vary': 'Origin',
      },
    }
  }

  const allowedList = allowedEnv.split(',').map((s) => s.trim()).filter(Boolean)
  const isTpsVercelOrigin = /^https:\/\/tps(?:-zeta|-naung-naungs-projects-f5910407|-git-[a-z0-9-]+-naung-naungs-projects-f5910407|-[a-z0-9]+-naung-naungs-projects-f5910407)\.vercel\.app$/.test(requestOrigin)
  const matched = allowedList.includes(requestOrigin) || (allowedList.some((o) => o.endsWith('.vercel.app')) && isTpsVercelOrigin)
  const originAllowed = !requestOrigin || matched
  const allowOrigin = matched ? requestOrigin : allowedList[0]

  return {
    originAllowed,
    corsHeaders: {
      'Access-Control-Allow-Origin': allowOrigin,
      'Access-Control-Allow-Headers': ALLOWED_HEADERS,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Vary': 'Origin',
    },
  }
}

/**
 * Handles CORS preflight, disallowed Origin rejection, and HTTP 405 method enforcement.
 * Returns a Response when the request should terminate early, or null to proceed with POST.
 */
export function enforcePostAndCors(req: Request, originAllowed: boolean, corsHeaders: Record<string, string>): Response | null {
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

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed.' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Allow': 'POST, OPTIONS' },
        status: 405,
      }
    )
  }

  return null
}

/**
 * Extracts `session_id` claim from an already-validated Supabase Auth JWT.
 */
export function extractSessionIdFromJwt(jwt: string): string | null {
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

export interface VerifiedSystemAdminResult {
  caller?: { id: string }
  callerProfile?: { role: string; is_active: boolean; username?: string | null }
  errorResponse?: Response
}

/**
 * Verifies caller Bearer JWT, active 12h Email OTP 2FA session, and active
 * `system` / `master` admin profile. Returns either `{ caller, callerProfile }`
 * or an HTTP `errorResponse` (`401`/`403`).
 */
export async function requireVerifiedSystemAdmin(
  req: Request,
  // deno-lint-ignore no-explicit-any
  supabaseAdmin: any,
  corsHeaders: Record<string, string>,
  forbiddenMessage = 'Forbidden: only active System Administrators can perform this action.'
): Promise<VerifiedSystemAdminResult> {
  const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' }

  const authHeader = req.headers.get('Authorization') ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : ''
  if (!token) {
    return {
      errorResponse: new Response(
        JSON.stringify({ error: 'Unauthorized: missing authorization token.' }),
        { headers: jsonHeaders, status: 401 }
      ),
    }
  }

  const { data: { user: caller }, error: callerErr } = await supabaseAdmin.auth.getUser(token)
  if (callerErr || !caller) {
    return {
      errorResponse: new Response(
        JSON.stringify({ error: 'Unauthorized: invalid or expired session.' }),
        { headers: jsonHeaders, status: 401 }
      ),
    }
  }

  const sessionId = extractSessionIdFromJwt(token)
  if (!sessionId) {
    return {
      errorResponse: new Response(
        JSON.stringify({ error: 'Unauthorized: invalid session token.' }),
        { headers: jsonHeaders, status: 401 }
      ),
    }
  }

  const twelveHoursAgoIso = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString()
  const { data: verifiedSession, error: verifiedErr } = await supabaseAdmin
    .from('verified_2fa_sessions')
    .select('session_id, verified_at')
    .eq('session_id', sessionId)
    .eq('user_id', caller.id)
    .gt('verified_at', twelveHoursAgoIso)
    .maybeSingle()

  if (verifiedErr || !verifiedSession) {
    return {
      errorResponse: new Response(
        JSON.stringify({ error: 'Forbidden: 2FA verification required.' }),
        { headers: jsonHeaders, status: 403 }
      ),
    }
  }

  const { data: callerProfile, error: callerProfileErr } = await supabaseAdmin
    .from('profiles')
    .select('role, is_active, username')
    .eq('id', caller.id)
    .single()

  if (
    callerProfileErr ||
    !callerProfile ||
    callerProfile.is_active === false ||
    !['system', 'master'].includes(callerProfile.role)
  ) {
    return {
      errorResponse: new Response(
        JSON.stringify({ error: forbiddenMessage }),
        { headers: jsonHeaders, status: 403 }
      ),
    }
  }

  return { caller, callerProfile }
}
