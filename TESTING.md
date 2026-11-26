# Testing & Verification Guide — Ta'ang Population System (TPS)

> **Scope:** Documents all verified build/lint/type/security checks currently available, missing test infrastructure, and recommended test suites for TPS on branch `cleanup/dead-code-audit`.

---

## 1. Current Verification Status

| Check | Command | Latest Observed Result | Notes / Environment Conditions |
| :--- | :--- | :--- | :--- |
| **Production Build & Bundle** | `npm run build` (`vite build`) | **Passed** (`exit code 0`, `1.33s`, `2,239` modules) | Produced `dist/index.html` (`1.72 kB`), `dist/assets/index-*.css` (`30.62 kB`), and `dist/sw.js` (excludes `supabase` cache). Emits non-fatal warnings for unresolved `/assets/fonts/Pyidaungsu.ttf` and Vite CJS-vs-ESM config loading. |
| **Edge Function Linting** | `deno lint --rules-exclude=no-import-prefix supabase/functions` | **Passed** (`exit code 0`, `3` files clean) | Covers `create-user/index.ts`, `send-otp/index.ts`, and `verify-otp/index.ts`. |
| **Edge Function Type Check** | `deno check --no-lock supabase/functions/*/index.ts` | **Passed** (`exit code 0`, `3` files clean) | TypeScript `6.0.3` / Deno `2.9.8` (`v8 15.0.245.2-rusty`). |
| **Edge Runtime Security Tests (Mocked HTTP)** | Deno test script (`run_edge_tests.ts` in scratch directory) | **Passed** (`exit code 0`, `3` suites) | Covers `create-user`, `send-otp`, and `verify-otp` handlers against a local mock HTTP server. Not yet committed inside the repository. |
| **PostgreSQL RLS Security Tests** | PowerShell harness (`run_pg_security_tests.ps1` in scratch directory) | **Blocked / Not Executed** (`exit code 1`) | Failed because Docker Desktop Linux Engine daemon was stopped (`open //./pipe/dockerDesktopLinuxEngine: The system cannot find the file specified`). |
| **Browser UI Smoke Test** | Browser automation (`Chrome DevTools`) | **Not Executed** | Chrome remote debugging (`DevToolsActivePort`) was inactive on the host environment. |

---

## 2. Installed vs Missing Tooling

### Available in Current Environment
- **Runtime / Package Manager:** Node.js `v24.14.0`, npm `11.9.0`
- **Edge Runtime / Type Checker / Linter:** Deno `2.9.8`
- **Backend / Infra CLIs:** Supabase CLI `2.101.0` (requires running outside sandbox on Windows), Vercel CLI `53.3.2`, Git `2.53.0.windows.2`, Docker `29.9.3` (CLI installed; daemon must be started before DB container tests)

### Missing from Repository & Environment (`package.json` has only `dev`, `build`, `preview`)
- **Frontend Unit/Integration Test Runner:** `vitest` (or `jest`), `@testing-library/react`, `jsdom`
- **Frontend Linter / Type Checker:** `eslint`, `tsc` (TypeScript is not configured for `src/` JSX files)
- **End-to-End Browser Framework:** `playwright`
- **Local SQL Client:** native `psql` (must use Docker Postgres container or Supabase CLI)

> **Rule Reminder:** Do not install new tools or devDependencies without explicit user approval.

---

## 3. Recommended Test Suites to Implement

Before adding features or fixing high-risk bugs, introducing a lightweight test suite in the repo is recommended (prioritized by security and data-integrity risk):

### 3.1 Security & Sanitization Unit Tests (Vitest)
1. **`excelParser.js` & `exportSanitize.js`:**
   - Neutralization of formula-injection prefixes (`=`, `+`, `-`, `@`, `\t`, `\r`) across CSV/XLSX import and export cells.
   - Header mapping validation, malformed row rejection, and bounded row handling.
2. **`querySanitize.js` & `exportFilename.js`:**
   - Escaping PostgREST `.or()` / `.ilike()` filter special characters (`,`, `(`, `)`, `%`, `_`, quotes) to prevent filter injection.
   - Stripping path separators and unsafe characters from generated filenames.
3. **`secureStorage.js` & `offlineCache.js`:**
   - Session-scoped CSPRNG protection (verifying plaintext PII is not persisted verbatim in `localStorage` and old sessions cannot decrypt new sessions).
   - User ID cache key namespacing, short TTL expiration, and full cleanup on logout/login.
4. **`roleHelper.js`:**
   - Exhaustive assertions across roles (`system`, `master`, `admin`, `regional`, `ops`, `field`), `access_level` values (`central`, `district`, `township`, `viewer`, `sub_township`), and edge-case/unknown role strings (must fail closed to minimum privilege).

### 3.2 Critical Bug & Data Integrity Regression Tests
1. **`householdPrint.js` Gender Helper (`isMale('ကျား')`):**
   - Add regression tests verifying Myanmar gender string matching (`ကျား` vs `မ`) produces accurate male/female counts in printed household cards and reports (see known `isMale` bug in `src/lib/householdPrint.js`).
2. **Pagination Integrity (`DatabaseBackup.jsx`, `Reports.jsx`):**
   - Mock Supabase responses exceeding 1,000 rows to ensure `.range()` pagination retrieves 100% of records rather than silently truncating at PostgREST's 1,000-row limit.
3. **`UserManagement.jsx` Render Stability:**
   - Render tests covering loading, error, empty, and active states to prevent React conditional-hooks crashes.

### 3.3 Edge Function & RLS Integration Tests (Committed in Repo)
1. **Commit Edge Security Suites:** Promote `run_edge_tests.ts` into a committed `supabase/functions/_tests/` suite runnable in CI via `deno test` covering:
   - Missing/malformed JWT -> `401`
   - Invalid `Origin` -> CORS rejection
   - Non-admin caller to `create-user` -> `403`
   - Unverified 2FA or expired 2FA session -> `403`
   - Valid `send-otp` / `verify-otp` HMAC challenge & expiry enforcement
2. **Database RLS Adversarial Tests:** With Docker Desktop running, run PostgreSQL tests using `supabase start` or a test Postgres container verifying:
   - Anonymous (`anon`) role has zero table/RPC `EXECUTE` access on PII and internal tables (`otp_codes`, `verified_2fa_sessions`, `tps_access_token`).
   - Authenticated users *without* active 2FA session are denied household/profile mutations and reads.
   - Scoped users (`district` / `township` access levels) cannot read, update, or export households outside their assigned `allowed_districts` / `allowed_townships`.
   - `viewer` and `sub_township` users cannot insert/update/delete `households` directly; `viewer` users must go through `print_export_requests` (and `sub_township` request inserts are denied by RLS).

### 3.4 End-to-End Route & RBAC Tests (Playwright)
- Unauthenticated redirect to `/login`
- Step-up Email OTP 2FA gate blocking app routes until verified
- Role-gated navigation visibility & direct-URL access protection for `UserManagement` (`/users`), `DatabaseBackup` (`/backup`), `Reports` (`/central-database`), `CsvUploader` (`/upload`, including `'regional'` consistency), and `NotificationsRequests` (`/notifications-requests`)
