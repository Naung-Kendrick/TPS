# Project Overview — Ta'ang Population System (TPS)

> Official Civil Population Registry, Analytics & Identity Verification Web Application for the **Immigration Department of Ta'ang Land (IDTL / TLFUG Immigration)**.

---

## 1. Purpose
The **Ta'ang Population System (TPS)** digitizes, validates, stores, searches, verifies, analyzes, prints, and archives household and resident civil registration records across Ta'ang districts, townships, wards, village groups, and villages with bilingual Myanmar (Unicode) and English workflows.

---

## 2. Target Users & Roles

| Role | Access Levels | Primary Responsibilities |
|---|---|---|
| `system` / `master` | `central` (or scoped) | Account provisioning (`/users`), account activation/disablement, role & geographic scope management, full database backup (`/backup` for `central`), approvals, all data operations |
| `admin` / `regional` | `central`, `district`, `township`, `viewer`, `sub_township` | District/regional verification, Central Database drilldown & audited edits/deletes, statistics, viewer print/export approvals *(Note: `regional` role currently blocked on `/upload` UI route guard in `App.jsx`/`Sidebar.jsx`)* |
| `ops` | `district`, `township`, `central` | Data verification, bulk CSV/XLSX/XLS/JSON imports (`/upload`), household registration, Central Database drilldown & edits, analytics |
| `field` | `township`, `district`, `central` | Household & member registration (`/registration`), ID card QR verification (`/scanner`), record lookup (`/verification`), Central Database drilldown (within scope) |
| Any role (`viewer` / `sub_township`) | `viewer`, `sub_township` | Read-only verification & statistics views; `viewer` uses print/export approval request flow (`sub_township` blocked from DB request writes by RLS) |

---

## 3. Core Features

1. **Authentication & Mandatory Email OTP 2FA**: Username + PIN (`<username>@tps.idtl`) followed by cryptographic 6-digit Email OTP verification (`send-otp` / `verify-otp`), 12-hour server-side 2FA session TTL (`is_2fa_verified()`), 30-minute client idle auto-logout, and hybrid client brute-force lockout (`Login.jsx`).
2. **Data Verification & Household Export** (`/verification`): Scoped multi-field & NRC search, inline household family tree view, and Household Excel/PDF export (`Verification.jsx`).
3. **Bulk Data Import** (`/upload`): Client-side CSV (`papaparse`), `.xlsx` (`exceljs`), legacy `.xls` (lazy `xlsx`), and JSON parsing with Myanmar Unicode validation, date normalization, identity-based deduplication, and batch inserts (`CsvUploader.jsx`).
4. **ID Card QR Scanner** (`/scanner`): Live multi-angle (`0°–270°`) camera QR decoding (`jsqr`) and manual Ta'ang Land ID lookup with household modal (`IDCardScanner.jsx`).
5. **Household Registration** (`/registration`): Bilingual registration form with draft auto-save (`sessionStorage`), offline retry queue (`retryQueue.js`), live family roster, inline member edit (`EditHouseholdModal.jsx`), and member removal (`HouseholdForm.jsx`).
6. **Central Database Explorer** (`/central-database`): 6-level geographic drilldown (`District → Township → Ward/Group → Village → Household → Members`) with 15-minute user-scoped IndexedDB caching, Realtime family sync, PIN-verified edit/delete + `audit_logs`, and JSON/Excel exports (`Reports.jsx`).
7. **Population Statistics & Demographic Dashboard** (`/statistics`, `/demographics`): Server-aggregated breakdown RPCs (`stats_breakdown`), age pyramids, religion/nationality/occupation charts, Legal-landscape PDF print previews, Excel exports, and viewer approval requests (`PopulationStatistics.jsx`, `DemographicDashboard.jsx`).
8. **Notifications & Approvals** (`/notifications-requests`): System alert viewer and Realtime viewer print/export approval workflow (`NotificationsRequests.jsx`).
9. **User Management** (`/users`): Admin-only account creation via `create-user` Edge Function, active/disable toggle, and role/district/township assignment (`UserManagement.jsx`).
10. **Database Backup & Archival** (`/backup`): Central-admin JSON & Excel backup exports with server-side `audit_logs` tracking (`DatabaseBackup.jsx`).

---

## 4. Technology Stack

- **Frontend**: React `^19.2.5`, React DOM `^19.2.5`, React Router DOM `^7.15.0`
- **Build & PWA**: Vite `^8.0.10`, `@vitejs/plugin-react` `^6.0.1`, `vite-plugin-pwa` `^1.3.0` (Workbox)
- **Styling & UI**: Tailwind CSS `^3.4.19`, PostCSS `^8.5.14`, Autoprefixer `^10.5.0`, `lucide-react` `^1.14.0`, custom CSS variables (`0px` Architect aesthetic)
- **Data / Files / QR**: `@supabase/supabase-js` `^2.105.3`, `exceljs` `^4.4.0`, `xlsx` `^0.18.5` (`.xls` only), `papaparse` `^5.5.3`, `jsqr` `^1.4.0`
- **Backend & DB**: Supabase (PostgreSQL `17.6`, GoTrue `v2.189.0`, PostgREST `v14.5`, Storage `v1.58.17`), 3 Deno Edge Functions (`std@0.168.0`), Resend Email API
- **Hosting**: Vercel SPA CDN (`tps-zeta.vercel.app`) + Supabase (`zmluxfounnwunoajapml`, `aws-1-ap-southeast-1`)

---

## 5. Current Project Status & Baseline
- **Active Branch**: `cleanup/dead-code-audit` (`c889e0e`, branched after security hardening commit `013ece6` on `main`).
- **Security Posture**: Hardened auth/2FA (`is_2fa_verified()` 12h TTL), geographic & role RLS on all 7 tables + `id-scans` storage bucket, tamper-proof `audit_logs` DB triggers, XSS/CSV/PostgREST sanitizers, CSPRNG session-scoped client PII protection, strict CSP/HSTS headers, and zero Supabase REST caching in Service Worker.
- **Known Active Engineering Items** (see `SECURITY.md` and `TESTING.md` for full details):
  - Unpaginated PostgREST `.select()` queries in `DatabaseBackup.jsx` and `Reports.jsx` full exports truncate at 1,000 rows unless `.range()` paginated.
  - `householdPrint.js` `isMale()` checks `'က'` instead of `'ကျား'`.
  - `20260522_stats_age_pyramid.sql` is shadowed alphabetically by `20260522_stats_occupation_gender_id.sql` on fresh replay.
  - `/assets/fonts/Pyidaungsu.ttf` `@font-face` paths currently 404 in `dist/` (font lives at `src/assets/fonts/Pyidaungsu.ttf`).
  - No automated frontend unit/lint/E2E suite is installed in `package.json` yet (Deno Edge security tests and `vite build` pass cleanly).
