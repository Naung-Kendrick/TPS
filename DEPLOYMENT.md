# Deployment & Operations Guide — Ta'ang Population System (TPS)

> **Security Warning:** NEVER commit or print actual secret values (API keys, service role keys, `OTP_HMAC_SECRET`, database URLs with credentials, or `.env.local` contents). This guide specifies environment variable **names** and placeholders only.

---

## 1. Hosting & Infrastructure Stack

| Component | Provider / Target | Verified Details |
| :--- | :--- | :--- |
| **Frontend SPA** | **Vercel** (`tps` / `tps-zeta.vercel.app`) | Configured via [`.vercel/repo.json`](file:///c:/Users/User/Desktop/Our%202026%20Code%20PJ/TPS/.vercel/repo.json) and [`vercel.json`](file:///c:/Users/User/Desktop/Our%202026%20Code%20PJ/TPS/vercel.json) (global security headers + SPA rewrite to `/index.html`). |
| **Backend / Database / Auth / Storage / Edge** | **Supabase** (Project ref: `zmluxfounnwunoajapml`, Region: `aws-1-ap-southeast-1`) | PostgreSQL `17.6`, GoTrue `v2.189`, PostgREST `v14.5`, Storage `v1.58.17` (`id-scans` bucket), Deno Edge Functions (`create-user`, `send-otp`, `verify-otp`). |
| **Transactional OTP Email** | **Resend API** | Invoked by `supabase/functions/send-otp/index.ts` using server-side `RESEND_API_KEY` and `OTP_FROM_EMAIL`. |

---

## 2. Environment Variables & Secrets

### 2.1 Frontend Environment (`.env.local` & Vercel Project Env Vars)
Do **not** place secrets in `VITE_*` variables (Vite bundles all `VITE_*` vars into client-side JavaScript).

```env
VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-supabase-anon-publishable-key>
```

> [!CAUTION]
> **Do NOT set `VITE_SKIP_OTP`.** `VITE_SKIP_OTP` is a stale/unused legacy flag in environment templates; production and staging deployments must always enforce full Email OTP 2FA.

### 2.2 Supabase Edge Function Secrets
Configure via Supabase Dashboard or CLI (`supabase secrets set KEY=VALUE`):

| Secret Name | Purpose | Required |
| :--- | :--- | :--- |
| `ADMIN_SERVICE_ROLE_KEY` | Privileged Auth user provisioning in `create-user` | Yes |
| `PROJECT_URL` | Supabase project base URL for Edge admin clients | Yes |
| `OTP_HMAC_SECRET` | Cryptographic secret for HMAC-SHA256 OTP hashing (**no fallback allowed**) | Yes |
| `RESEND_API_KEY` | Server-side API key for sending 2FA OTP emails via Resend | Yes |
| `OTP_FROM_EMAIL` | Verified sender address for OTP emails | Yes |
| `ALLOWED_ORIGIN` | Strict origin allowlist for Edge Function CORS validation (e.g., `https://tps-zeta.vercel.app`) | Yes |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL`, `SUPABASE_JWKS`, `SUPABASE_PUBLISHABLE_KEYS`, `SUPABASE_SECRET_KEYS` | Built-in Supabase platform secrets | Managed by Supabase |

---

## 3. Local Development & Build Commands

| Task | Command | Notes |
| :--- | :--- | :--- |
| **Install dependencies** | `npm install` | Uses existing `package-lock.json` |
| **Start Vite dev server** | `npm run dev` | Local SPA dev server |
| **Production build** | `npm run build` | Builds `dist/` with Vite 8 (`dropConsole: true`, `dropDebugger: true`) and generates `dist/sw.js` via `vite-plugin-pwa` |
| **Preview built bundle** | `npm run preview` | Serves `dist/` locally for smoke verification |
| **Lint Edge Functions** | `deno lint --rules-exclude=no-import-prefix supabase/functions` | Requires Deno `2.9.8`+ |
| **Type-check Edge Functions** | `deno check --no-lock supabase/functions/*/index.ts` | Verifies Deno/TS compilation of all 3 Edge Functions |

---

## 4. Deployment Procedures

### 4.1 Frontend Deployment (Vercel)
1. Ensure pre-deploy checks pass locally: `npm run build` succeeds and `dist/sw.js` does not cache Supabase API routes.
2. Verify [`vercel.json`](file:///c:/Users/User/Desktop/Our%202026%20Code%20PJ/TPS/vercel.json) security headers (`Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `Strict-Transport-Security`) and SPA fallback rewrite are unchanged.
3. Deploy via Vercel Git integration on the target branch or run `vercel --prod` (after user confirmation).

### 4.2 Edge Functions Deployment (Supabase)
Deploy Edge Functions individually using the Supabase CLI (on Windows, CLI calls requiring network/auth run outside sandbox):

```powershell
supabase functions deploy send-otp --no-verify-jwt --use-api
supabase functions deploy verify-otp --no-verify-jwt --use-api
supabase functions deploy create-user --no-verify-jwt --use-api
```

> **Why `--no-verify-jwt`?** Each Edge Function handles CORS `OPTIONS` preflight requests and explicitly validates the caller's Bearer JWT + active profile + 2FA/role state inside the function body itself.

### 4.3 Database Migrations Warning
> [!WARNING]
> **Migration Alphabetical Conflict (`20260522`):** `supabase/migrations/` contains two files sharing the `20260522` prefix (`20260522_stats_age_pyramid.sql` and `20260522_stats_occupation_gender_id.sql`), and pre-`20260518` baseline DDL lives only in the live database rather than checked-in SQL files.
> - **Never** run `supabase db reset` against production or expect clean from-scratch local `supabase db push` without first pulling/baselining the pre-`20260518` schema and reconciling the `20260522` timestamp order.
> - Take a database backup / snapshot before applying any new migration.

---

## 5. Backups & Troubleshooting

### Backups
- **Database & Storage:** Rely on Supabase platform backups / `pg_dump` snapshots for full-fidelity recovery.
- **App-Level Backup (`DatabaseBackup.jsx`):** Note known issue **MED-04** — unpaginated client backup queries are subject to PostgREST's 1,000-row cap until `.range()` pagination is implemented. Do **not** rely solely on the in-app JSON/Excel backup for datasets exceeding 1,000 households.

### Known Build / Runtime Troubleshooting
1. **Build warning for `/assets/fonts/Pyidaungsu.ttf`:** `vite build` warns about an unresolved CSS reference to `/assets/fonts/Pyidaungsu.ttf` (font file not present in `public/assets/fonts/`). Browser falls back cleanly to system Myanmar fonts (`Noto Sans Myanmar` / OS fonts).
2. **Vite ESM-in-CJS config notice:** Vite emits a CJS-vs-ESM config-loading notice when loading `vite.config.js` while still building cleanly.
3. **Windows Sandbox & CLIs:** `supabase` CLI and `vercel` CLI commands require network/auth access and will fail inside the default offline terminal sandbox unless elevated/approved.
4. **2FA OTP Delivery Failures:** Verify `RESEND_API_KEY`, `OTP_FROM_EMAIL`, `OTP_HMAC_SECRET`, and `ALLOWED_ORIGIN` are set in Supabase Edge Function secrets and that the browser origin matches `ALLOWED_ORIGIN`.
