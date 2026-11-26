# AI Coding Agent Instructions — Ta'ang Population System (TPS)

> **Mandatory Security Rule:** Always follow [`AGENTS.md`](file:///c:/Users/User/Desktop/Our%202026%20Code%20PJ/TPS/AGENTS.md) as the top-priority rulebook alongside this handbook. Whenever evaluating trade-offs, prioritize security posture (attack surface, least privilege, PII protection, fail-closed guarantees) over convenience or speed.

---

## 1. Required Workflow for Future AI Agents

1. **Read Context First:** Read [`AGENTS.md`](file:///c:/Users/User/Desktop/Our%202026%20Code%20PJ/TPS/AGENTS.md), this file (`AI_INSTRUCTIONS.md`), and the relevant reference docs ([`ARCHITECTURE.md`](file:///c:/Users/User/Desktop/Our%202026%20Code%20PJ/TPS/ARCHITECTURE.md), [`DATABASE_SCHEMA.md`](file:///c:/Users/User/Desktop/Our%202026%20Code%20PJ/TPS/DATABASE_SCHEMA.md), [`SECURITY.md`](file:///c:/Users/User/Desktop/Our%202026%20Code%20PJ/TPS/SECURITY.md), [`FEATURES.md`](file:///c:/Users/User/Desktop/Our%202026%20Code%20PJ/TPS/FEATURES.md)) instead of older legacy docs.
2. **Inspect Before Editing:** Search and read the actual target source files, imports, callers, database migrations/RLS policies, and Edge Functions before proposing or making changes.
3. **Check Security & Scope Impact:** Confirm whether the change touches citizen PII, auth/2FA, RLS, Edge Functions, CSP headers, Service Worker caching, or export sanitization. Flag any security risks to the user before proceeding.
4. **Preserve Architecture:** Keep edits minimal and local to the task. Do not perform unrequested refactors or alter unrelated features/workflows.
5. **Verify Before Reporting:** Run applicable verification commands (`npm run build`, Deno lint/check, tests), inspect `git diff` / `git status`, and report only directly observed results and skipped/unrun checks accurately.

---

## 2. Authoritative vs Stale Documentation

- **Authoritative Suite:** [`AGENTS.md`](file:///c:/Users/User/Desktop/Our%202026%20Code%20PJ/TPS/AGENTS.md), [`PROJECT_OVERVIEW.md`](file:///c:/Users/User/Desktop/Our%202026%20Code%20PJ/TPS/PROJECT_OVERVIEW.md), [`ARCHITECTURE.md`](file:///c:/Users/User/Desktop/Our%202026%20Code%20PJ/TPS/ARCHITECTURE.md), [`DATABASE_SCHEMA.md`](file:///c:/Users/User/Desktop/Our%202026%20Code%20PJ/TPS/DATABASE_SCHEMA.md), [`FEATURES.md`](file:///c:/Users/User/Desktop/Our%202026%20Code%20PJ/TPS/FEATURES.md), [`SECURITY.md`](file:///c:/Users/User/Desktop/Our%202026%20Code%20PJ/TPS/SECURITY.md), [`TESTING.md`](file:///c:/Users/User/Desktop/Our%202026%20Code%20PJ/TPS/TESTING.md), [`DEPLOYMENT.md`](file:///c:/Users/User/Desktop/Our%202026%20Code%20PJ/TPS/DEPLOYMENT.md), `AI_INSTRUCTIONS.md`.
- **Do NOT Rely On Legacy Root Docs:** Six pre-existing root Markdown files (`my_project.md`, `my_theme.md`, `CSV_UPLOAD_RULES.md`, `Role_And_Login_System.md`, `Supabase_Readme.md`, `TPS_ARCHITECTURE_VISION.md`) are stale/outdated and do not accurately describe the hardened codebase on `cleanup/dead-code-audit`.

---

## 3. Repository Structure & Reusable Utilities

The codebase contains **85** non-generated files (`16` root files, `2` `public/icons/`, `38` `src/`, `29` `supabase/` including `17` migrations and `3` Edge Functions).

### Reuse Existing Helpers in `src/lib/` & `src/components/`
Do not duplicate logic that already exists:
- **Supabase Client:** [`src/lib/supabase.js`](file:///c:/Users/User/Desktop/Our%202026%20Code%20PJ/TPS/src/lib/supabase.js)
- **RBAC / Scope Logic:** [`src/lib/roleHelper.js`](file:///c:/Users/User/Desktop/Our%202026%20Code%20PJ/TPS/src/lib/roleHelper.js)
- **Session-Scoped PII Storage:** [`src/lib/secureStorage.js`](file:///c:/Users/User/Desktop/Our%202026%20Code%20PJ/TPS/src/lib/secureStorage.js)
- **Offline IndexedDB Cache (short TTL, user-namespaced):** [`src/lib/offlineCache.js`](file:///c:/Users/User/Desktop/Our%202026%20Code%20PJ/TPS/src/lib/offlineCache.js)
- **Mutation Retry Queue:** [`src/lib/retryQueue.js`](file:///c:/Users/User/Desktop/Our%202026%20Code%20PJ/TPS/src/lib/retryQueue.js)
- **Sanitization & Export Safety:** [`src/lib/querySanitize.js`](file:///c:/Users/User/Desktop/Our%202026%20Code%20PJ/TPS/src/lib/querySanitize.js), [`src/lib/exportSanitize.js`](file:///c:/Users/User/Desktop/Our%202026%20Code%20PJ/TPS/src/lib/exportSanitize.js), [`src/lib/exportFilename.js`](file:///c:/Users/User/Desktop/Our%202026%20Code%20PJ/TPS/src/lib/exportFilename.js), [`src/lib/excelParser.js`](file:///c:/Users/User/Desktop/Our%202026%20Code%20PJ/TPS/src/lib/excelParser.js), [`src/lib/printWindowHelper.js`](file:///c:/Users/User/Desktop/Our%202026%20Code%20PJ/TPS/src/lib/printWindowHelper.js)
- **Shared UI Components:** [`src/components/EmptyState.jsx`](file:///c:/Users/User/Desktop/Our%202026%20Code%20PJ/TPS/src/components/EmptyState.jsx), [`src/components/Skeleton.jsx`](file:///c:/Users/User/Desktop/Our%202026%20Code%20PJ/TPS/src/components/Skeleton.jsx), [`src/components/layout/TpsScrollWrapper.jsx`](file:///c:/Users/User/Desktop/Our%202026%20Code%20PJ/TPS/src/components/layout/TpsScrollWrapper.jsx)

---

## 4. Architecture, Role & Database Conventions

- **Roles & Scope Caveats:** TPS uses roles (`system`, `master`, `admin`, `regional`, `ops`, `field`) paired with `access_level` (`central`, `district`, `township`, `viewer`, `sub_township`) and geographic arrays (`allowed_districts`, `allowed_townships`). Always inspect both [`src/lib/roleHelper.js`](file:///c:/Users/User/Desktop/Our%202026%20Code%20PJ/TPS/src/lib/roleHelper.js) and PostgreSQL RLS policies for edge cases (such as `'regional'` currently blocked on `/upload` in `App.jsx`/`Sidebar.jsx` and `'sub_township'` blocked from `print_export_requests` inserts by RLS) before modifying permissions or queries.
- **Query & RPC Security:**
  - Escape user search inputs with `querySanitize.js` before passing to `.or()` / `.ilike()`.
  - Any new PostgreSQL `SECURITY DEFINER` RPC **must** include `SET search_path = 'public'`, enforce `is_2fa_verified()` + active profile + role/scope checks, and `REVOKE ALL ... FROM PUBLIC, anon`.
  - Use explicit `.range()` pagination on queries that may exceed PostgREST's 1,000-row default limit.
- **Edge Functions:**
  - Enforce strict `Origin` validation against `ALLOWED_ORIGIN` (fail closed), verify caller JWT + role/2FA server-side, validate and bound all inputs, roll back partial writes on error, and never leak secrets or stack traces.

---

## 5. Strict Off-Limits Rules

- **NEVER** read, print, copy, commit, or log values from `.env.local` or secret stores.
- **NEVER** bypass or relax RLS (`USING (true)`), `is_2fa_verified()`, `OTP_HMAC_SECRET`, CSP/headers in `vercel.json`, or `VITE_SKIP_OTP` guards.
- **NEVER** configure Workbox / Service Worker in `vite.config.js` to cache Supabase API/Storage responses containing citizen PII, or store unencrypted citizen PII in `localStorage`.
- **NEVER** run `supabase db reset`, drop production tables, or deploy Edge Functions/Vercel builds without explicit user approval.
- **NEVER** re-introduce previously removed unused dependencies (`@zxing/browser`, `@zxing/library`, `html5-qrcode`, `jszip`, `knayi-myscript`, `qrcode`) without justification.

---

## 6. Known Traps & Open Bugs to Watch

1. **`householdPrint.js` Gender Bug (`isMale('ကျား')`):** Check and fix gender-matching logic before modifying household card prints or gender breakdowns.
2. **`UserManagement.jsx` Hooks Ordering Bug:** Inspect conditional/early-return placement relative to React `useState`/`useEffect` hooks whenever editing [`src/components/UserManagement.jsx`](file:///c:/Users/User/Desktop/Our%202026%20Code%20PJ/TPS/src/components/UserManagement.jsx).
3. **1,000-Row PostgREST Limit:** `DatabaseBackup.jsx` and `Reports.jsx` can silently truncate datasets above 1,000 rows unless paginated.
4. **20260522 Migration Ordering Conflict:** Two migrations share `20260522` (`20260522_stats_age_pyramid.sql` and `20260522_stats_occupation_gender_id.sql`), and pre-`20260518` baseline DDL exists only in the live DB.
5. **Dual Spreadsheet Libraries:** Both `exceljs` and `xlsx@0.18.5` are currently installed (`HIGH-01` vulnerability in `xlsx`). Prefer `exceljs` for new code and plan `xlsx` removal.

---

## 7. Standard Verification Commands

```powershell
# Frontend production bundle + PWA/SW output
npm run build

# Supabase Edge Functions lint & TypeScript check
deno lint --rules-exclude=no-import-prefix supabase/functions
deno check --no-lock supabase/functions/*/index.ts

# Inspect git state
git status --short
```
