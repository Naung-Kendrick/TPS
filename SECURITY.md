# Security Architecture & Findings — Ta'ang Population System (TPS)

> **Authoritative Policy:** Security rules in [`AGENTS.md`](file:///c:/Users/User/Desktop/Our%202026%20Code%20PJ/TPS/AGENTS.md) supersede convenience or speed. All changes must fail closed by default.
> **Note:** This document reflects the verified security posture on branch `cleanup/dead-code-audit` (`c889e0e`). Pre-`20260518` baseline DDL in the remote database is not checked into `supabase/migrations/` and is only observable via later migrations and Edge Functions.

---

## 1. Security Baselines Overview

| Layer | Implemented Controls | Key Files |
| :--- | :--- | :--- |
| **Authentication & 2FA** | Supabase Auth (`@supabase/supabase-js`) + mandatory Email OTP 2FA via `send-otp` & `verify-otp` Edge Functions; `verified_2fa_sessions` tracked server-side and checked via `is_2fa_verified()`; HMAC verification requires `OTP_HMAC_SECRET` (no fallback); minimum 8-char PIN/password rules | [`src/components/Login.jsx`](file:///c:/Users/User/Desktop/Our%202026%20Code%20PJ/TPS/src/components/Login.jsx), [`supabase/functions/send-otp/index.ts`](file:///c:/Users/User/Desktop/Our%202026%20Code%20PJ/TPS/supabase/functions/send-otp/index.ts), [`supabase/functions/verify-otp/index.ts`](file:///c:/Users/User/Desktop/Our%202026%20Code%20PJ/TPS/supabase/functions/verify-otp/index.ts) |
| **Authorization, RBAC & RLS** | Row-Level Security on tables and `storage.objects` (`id-scans`); enforces active user status, `is_2fa_verified()`, role, and geographic scope; `SECURITY DEFINER` RPCs pin `SET search_path = 'public'` and restrict `EXECUTE` (`REVOKE ALL ... FROM PUBLIC, anon`); internal tables (`otp_codes`, `verified_2fa_sessions`, `tps_access_token`) restricted from client roles | [`src/lib/roleHelper.js`](file:///c:/Users/User/Desktop/Our%202026%20Code%20PJ/TPS/src/lib/roleHelper.js), [`supabase/functions/create-user/index.ts`](file:///c:/Users/User/Desktop/Our%202026%20Code%20PJ/TPS/supabase/functions/create-user/index.ts), `supabase/migrations/*.sql` |
| **Client PII Protection** | `vite-plugin-pwa` caches fonts only (excludes Supabase API/citizen PII from Service Worker); `secureStorage.js` applies session-scoped CSPRNG protection for PII keys instead of raw `localStorage`; IndexedDB offline cache (`offlineCache.js`) uses short TTL and `user.id` namespacing; login/logout clears caches (`App.jsx`) | [`vite.config.js`](file:///c:/Users/User/Desktop/Our%202026%20Code%20PJ/TPS/vite.config.js), [`src/lib/secureStorage.js`](file:///c:/Users/User/Desktop/Our%202026%20Code%20PJ/TPS/src/lib/secureStorage.js), [`src/lib/offlineCache.js`](file:///c:/Users/User/Desktop/Our%202026%20Code%20PJ/TPS/src/lib/offlineCache.js), [`src/App.jsx`](file:///c:/Users/User/Desktop/Our%202026%20Code%20PJ/TPS/src/App.jsx) |
| **Input & Output Sanitization** | Query filter escaping (`querySanitize.js`), CSV/Excel formula neutralization (`exportSanitize.js`, `excelParser.js`), filename sanitization (`exportFilename.js`), safe print window assembly (`printWindowHelper.js`) | [`src/lib/querySanitize.js`](file:///c:/Users/User/Desktop/Our%202026%20Code%20PJ/TPS/src/lib/querySanitize.js), [`src/lib/exportSanitize.js`](file:///c:/Users/User/Desktop/Our%202026%20Code%20PJ/TPS/src/lib/exportSanitize.js), [`src/lib/excelParser.js`](file:///c:/Users/User/Desktop/Our%202026%20Code%20PJ/TPS/src/lib/excelParser.js), [`src/lib/printWindowHelper.js`](file:///c:/Users/User/Desktop/Our%202026%20Code%20PJ/TPS/src/lib/printWindowHelper.js) |
| **Transport & Browser Headers** | Global HTTP headers in `vercel.json`: `Content-Security-Policy`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(self), microphone=(), geolocation=()`, `Strict-Transport-Security: max-age=31536000; includeSubDomains` | [`vercel.json`](file:///c:/Users/User/Desktop/Our%202026%20Code%20PJ/TPS/vercel.json) |
| **Production Logging** | Vite 8 `build.rolldownOptions.output.minify.compress` strips `console.*` (`dropConsole: true`) and `debugger` (`dropDebugger: true`) in production builds | [`vite.config.js`](file:///c:/Users/User/Desktop/Our%202026%20Code%20PJ/TPS/vite.config.js) |

---

## 2. Hardened Controls Detail

### 2.1 Authentication & Edge Functions
- **No Secret Fallbacks:** Edge Functions require `OTP_HMAC_SECRET` without hardcoded default fallbacks.
- **Origin & Auth Checks:** Edge Functions validate `Origin` against allowlists, verify caller JWTs + active profile/role/2FA state server-side (`create-user` verifies admin caller & rolls back Auth user creation if profile insert fails), and avoid returning raw internal secrets or stack traces.
- **Role Scope Guardrails:** Frontend permissions in [`src/lib/roleHelper.js`](file:///c:/Users/User/Desktop/Our%202026%20Code%20PJ/TPS/src/lib/roleHelper.js) mirror server RLS role (`system`, `master`, `admin`, `regional`, `ops`, `field`) and `access_level` (`central`, `district`, `township`, `viewer`, `sub_township`) scopes, while Postgres RLS remains the authoritative security boundary.

### 2.2 Storage, Caching & PII Hygiene
- **Service Worker (`vite.config.js`):** Configured with `includeAssets: ['favicon.ico', 'src/assets/fonts/IDTL_logo.png']` and fonts-only `runtimeCaching`. Supabase REST/Storage endpoints are never cached in Workbox.
- **Session-Scoped Protection (`secureStorage.js`):** Protects sensitive client storage keys with session-scoped CSPRNG keying rather than leaving plaintext citizen PII in persistent `localStorage`.
- **Cache Isolation (`offlineCache.js`, `App.jsx`):** Offline IndexedDB entries are namespaced by `user.id`, expire after a short TTL, and are cleared across login and logout transitions to prevent cross-user leakage on shared devices.

---

## 3. Verified Security Findings & Technical Debt Register

The following findings were verified directly during the repository audit and are prioritized by severity.

| ID | Severity | Area | Finding Summary | Recommended Remediation |
| :--- | :--- | :--- | :--- | :--- |
| **HIGH-01** | **High** | Dependencies | `xlsx@0.18.5` carries known upstream security advisories (e.g., prototype pollution / ReDoS in legacy SheetJS CE npm release) while `exceljs@4.4.0` is already a project dependency | Migrate remaining `.xlsx` parsing/export paths from `xlsx` to `exceljs` or a patched maintained parser, then remove `xlsx` from `package.json` |
| **HIGH-02** | **High** | Auth & Lockout | Login & Reports PIN verification relies on client-side lockout counters (resettable on refresh/storage clear) and uses 8-character numeric PINs | Enforce server-side rate limiting / lockout tracking in Edge/Auth flows and migrate toward stronger passphrase/complexity requirements |
| **MED-01** | **Medium** | Edge Functions | If `ALLOWED_ORIGIN` is unset/empty, CORS validation can behave permissively rather than failing closed; Edge Functions also lack explicit HTTP `405 Method Not Allowed` rejection for non-`POST`/`OPTIONS` methods | Fail closed (`500` or deny CORS) when `ALLOWED_ORIGIN` is missing in production and return `405` on unsupported HTTP methods |
| **MED-02** | **Medium** | `send-otp` | OTP row insertion into `otp_codes` is not rolled back if the downstream Resend API email request fails | Delete or invalidate the newly inserted `otp_codes` row when Resend returns a non-OK response |
| **MED-03** | **Medium** | `retryQueue.js` / `main.jsx` | Retry queue is tab-scoped and `drainQueue()` runs on startup in `src/main.jsx` before 2FA verification completes, which can trigger expected auth/RLS failures before OTP completion | Trigger `drainQueue()` only after authenticated + 2FA-verified session state is established |
| **MED-04** | **Medium** | Data Integrity / Export | Unpaginated Supabase queries in backup/export (`DatabaseBackup.jsx`, `Reports.jsx`) are silently capped at PostgREST's 1,000-row default | Implement explicit `.range()` pagination loops or server-side export RPCs so backups/reports are complete |
| **MED-05** | **Medium** | Audit Trail | `HouseholdForm.jsx` roster member deletions and `EditHouseholdModal.jsx` edits bypass `audit_logs`, and `Reports.jsx` writes `audit_logs` *before* the primary mutation rather than atomically after or via DB trigger | Move immutable audit logging into PostgreSQL triggers or server-side RPCs inside the same transaction as data mutations |
| **MED-06** | **Medium** | User Lifecycle | Missing self-service/admin PIN reset UI; user accounts rely on synthetic `@tps.idtl` email patterns alongside separate OTP delivery addresses | Add audited admin-initiated credential reset via Edge Function and clarify real vs synthetic email separation |
| **MED-07** | **Medium** | CSP & Rendering | `vercel.json` CSP permits `*.supabase.co` wildcard rather than the exact project origin and allows `'unsafe-inline'` for styles; print flow uses `document.write` | Pin CSP `connect-src`/`img-src` to exact Supabase project host, audit inline style necessity, and replace `document.write` with Blob/iframe or declarative DOM APIs |
| **LOW-01** | **Low** | Client Storage | `src/lib/notifications.js` persists `tps_notifications` in `localStorage` and `secureStorage.js` uses lightweight XOR obfuscation (`tps_enc_v2:`) for non-session lockout keys | Remove XOR obfuscation (which offers no cryptographic confidentiality against XSS) and avoid storing sensitive metadata in `localStorage` |
| **LOW-02** | **Low** | Dead Schema | `tps_access_token` table and its legacy RPCs remain in the database layer despite being unused by the active Supabase Auth + 2FA flow | Audit remote DB dependencies and retire `tps_access_token` cleanly via migration once confirmed unused |
| **LOW-03** | **Low** | Config Hygiene | `VITE_SKIP_OTP` appears as an unused/stale env variable reference, and [`src/components/Login.jsx`](file:///c:/Users/User/Desktop/Our%202026%20Code%20PJ/TPS/src/components/Login.jsx#L180) surfaces raw auth configuration error details | Remove all `VITE_SKIP_OTP` references and map internal auth errors to generic user-safe messages |
| **LOW-04** | **Low** | Session Checks | Frontend does not periodically re-verify `is_2fa_verified()` status after initial session unlock (relies on RLS rejections if the 12-hour 2FA window expires) | Periodically check 2FA expiry or intercept RLS 2FA-rejection responses to prompt clean re-verification |
| **INFO-01** | **Info** | CI & Edge Query | Repository lacks automated CI security gates (build + Deno lint/check + Edge/PG tests); `create-user` omits the 12-hour `verified_at` recency filter when querying `verified_2fa_sessions` | Add GitHub Actions CI checks and align `create-user` `verified_2fa_sessions` timestamp check with DB `is_2fa_verified()` |

---

## 4. Security Verification Rules for Future Changes

Before merging any security-sensitive change:
1. Run `npm run build` and inspect `dist/sw.js` to verify no Supabase PII endpoints are cached.
2. Run `deno lint --rules-exclude=no-import-prefix supabase/functions` and `deno check --no-lock supabase/functions/*/index.ts`.
3. Run the Edge Function security tests (`run_edge_tests.ts`) and, with Docker running, PostgreSQL RLS adversarial tests (`run_pg_security_tests.ps1`).
4. Verify `vercel.json` security headers and CSP remain intact after deployment.
