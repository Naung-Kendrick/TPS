# Security-First Engineering Rule (Ta'ang Population System)

Security is the **first priority** for every task, feature, bugfix, refactoring, database change, deployment, or operational request in this repository.

## Mandatory Decision & Comparison Process
1. **Security-First Comparison**: Whenever evaluating solutions, architectures, or user requests, compare options primarily by security posture (attack surface, least privilege, data/PII exposure, fail-closed guarantees, and abuse resistance) before speed or convenience.
2. **Warn on Risky Shortcuts**: If any requested change or shortcut weakens authentication, authorization, RLS, input validation, CSP/headers, or PII handling, explicitly point out the risk and recommend the secure alternative before proceeding.
3. **Fail Closed by Default**: Never add insecure fallbacks (e.g., hardcoded keys, wildcard CORS in production, skipped 2FA/JWT checks, permissive `USING (true)` policies, or bypassing scope checks).

## Project Security Baselines (TPS)
- **Identity, Auth & 2FA**: Keep Email OTP 2FA enforced (`is_2fa_verified()`), enforce active-account checks, require `OTP_HMAC_SECRET` with no secret fallback, and maintain >= 8-character PIN/password rules.
- **Database & RLS**: Every table and storage policy must enforce RLS, active status, 2FA verification, and geographic/role scope. All `SECURITY DEFINER` RPCs must pin `SET search_path = 'public'` and restrict `EXECUTE` grants (`REVOKE ALL ... FROM PUBLIC, anon`). Keep sensitive internal tables (`otp_codes`, `verified_2fa_sessions`, `tps_access_token`) restricted from client roles.
- **Edge Functions**: Validate `Origin` strictly against allowlists, verify caller JWTs + role/2FA state server-side, validate/bound inputs cleanly, roll back partial writes on failure, and never expose internal secrets or stack traces.
- **Frontend & Citizen PII Protection**: Never cache Supabase citizen PII responses in Service Worker (`vite.config.mjs`) or `localStorage` (`secureStorage.js` uses session-scoped CSPRNG protection for PII keys). Keep IndexedDB offline TTL short (`offlineCache.js`), namespace caches per `user.id`, and clear caches on login/logout (`App.jsx`). Maintain CSP, frame/transport headers (`vercel.json`), and import/export validation (`excelParser.js`, `audit_logs`).
- **Verification**: Validate security assumptions with targeted tests (Edge runtime tests, SQL/RLS adversarial checks, production build / SW inspection, and live header/endpoint checks) before reporting completion.
