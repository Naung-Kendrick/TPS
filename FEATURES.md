# Features, Roles & Workflows — TPS

Verified mapping of user roles, access scopes, workflows, and status across the TPS frontend, Edge Functions, and PostgreSQL schema.

---

## 1. Role & Access-Level Permission Matrix

Roles: `system`, `master`, `admin` / `regional`, `ops`, `field`.
Access Levels: `central`, `district`, `township`, `viewer`, `sub_township`.

| Route / Capability | `system` / `master` (`central`) | `system` / `master` (scoped) | `admin` | `regional` | `ops` | `field` | Any role w/ `viewer` or `sub_township` |
|---|---|---|---|---|---|---|---|
| `/verification` — Search & View Family | Yes (All) | Scoped | Scoped | Scoped | Scoped | Scoped | Scoped |
| `/verification` — PDF / Excel Export | Yes | Yes | Yes | Yes | Yes | Yes | **Blocked** (`isViewOnly`) |
| `/upload` — Bulk Import | Yes | Scoped | Scoped | **Blocked in UI** *(bug: `'regional'` omitted in `App.jsx:223` & `Sidebar.jsx:110`)* | Scoped | **Blocked** | **Blocked** |
| `/scanner` — QR & Manual ID Lookup | Yes | Scoped | Scoped | Scoped | Scoped | Scoped | Scoped |
| `/statistics` & `/demographics` | Direct Print/Excel | Direct Print/Excel | Direct Print/Excel | Direct Print/Excel | Direct Print/Excel | Direct Print/Excel | `viewer`: request approval flow; `sub_township`: **RLS blocks request inserts** (`20260531:172`) |
| `/registration` — Register / Roster Edit / Delete | Yes | Scoped | Scoped | Scoped | Scoped | Scoped | **Blocked** |
| `/central-database` — Drilldown, Audited Edit/Delete, Exports | Yes | Scoped | Scoped | Scoped | Scoped | Scoped | **Blocked** |
| `/users` — Manage Users & Scopes | Yes | Yes | **Blocked** | **Blocked** | **Blocked** | **Blocked** | **Blocked** |
| `/backup` — Full JSON & Excel Archival | **Yes** | **Blocked** (`central` only) | **Blocked** | **Blocked** | **Blocked** | **Blocked** | **Blocked** |
| `/notifications-requests` — Approvals Tab | Yes | Yes | Yes | Yes | **Blocked** | **Blocked** | **Blocked** |

---

## 2. Feature-to-Code Mapping

| Feature | Frontend Files | Backend / API | Database Tables | Status |
|---|---|---|---|---|
| **Auth, Email OTP 2FA, Idle Logout & Lockout** | `src/App.jsx`, `Login.jsx`, `IntroAnimation.jsx`, `lib/supabase.js`, `lib/secureStorage.js` | Auth `signInWithPassword`, `send-otp`, `verify-otp`, `is_2fa_verified`, `revoke_current_2fa_session`, `verify_and_consume_otp` | `auth.users`, `profiles`, `otp_codes`, `verified_2fa_sessions` | Complete *(no PIN reset UI)* |
| **Data Verification & Household Export** | `Verification.jsx`, `lib/querySanitize.js`, `lib/householdPrint.js`, `lib/printWindowHelper.js`, `lib/exportFilename.js`, `lib/exportSanitize.js` | PostgREST `households` `SELECT` (limit 50 + family query) | `households` | Complete *(read-only; male `'ကျား'` bug in `householdPrint.js`)* |
| **Household Registration & Drafts** | `HouseholdForm.jsx`, `EditHouseholdModal.jsx`, `lib/retryQueue.js`, `lib/secureStorage.js`, `lib/querySanitize.js` | PostgREST `households` `SELECT`/`INSERT`/`UPDATE`/`DELETE` | `households` | Complete *(roster edit/delete bypass PIN/reason audit; offline queue tab-only)* |
| **Bulk Data Upload** | `CsvUploader.jsx`, `lib/excelParser.js`, `lib/exportSanitize.js`, `lib/notifications.js` | PostgREST `households` `SELECT` (dedup) & batch `INSERT` (200/batch) | `households` | Complete *(dedup scans only matching `household_no`)* |
| **ID Card QR Scanner** | `IDCardScanner.jsx`, `lib/querySanitize.js`, `lib/notifications.js` | PostgREST `households` `SELECT` | `households` | Complete |
| **Central Database Drilldown** | `Reports.jsx`, `lib/offlineCache.js`, `lib/householdPrint.js`, `lib/supabase.js`, `lib/exportFilename.js` | `report_*` RPCs, `households`, `audit_logs`, Realtime, `verifyOfficerPassword` | `households`, `audit_logs` | Complete *(>1,000-row cap on bulk exports; township breadcrumb jump bug)* |
| **Statistics & Demographics** | `PopulationStatistics.jsx`, `DemographicDashboard.jsx`, `lib/statisticsPrint.js` | `stats_*` RPCs, `households`, `print_export_requests`, Realtime | `households`, `print_export_requests` | Complete *(double mount fetch; `20260522` pyramid SQL conflict)* |
| **Notifications & Approvals** | `NotificationsRequests.jsx`, `lib/notifications.js`, `lib/roleHelper.js` | `print_export_requests` `SELECT`/`UPDATE`, Realtime | `print_export_requests` | Complete |
| **User Management** | `UserManagement.jsx`, `lib/roleHelper.js` | Edge `create-user`, `profiles` `SELECT`/`UPDATE`, `stats_townships` | `auth.users`, `profiles`, `verified_2fa_sessions` | Complete *(hooks ordering bug; viewer label hardcoded)* |
| **Database Backup** | `DatabaseBackup.jsx`, `lib/householdPrint.js`, `lib/secureStorage.js` | `households` `SELECT`, `audit_logs` `INSERT` | `households`, `audit_logs` | Complete *(>1,000-row truncation bug)* |

---

## 3. Core Workflow Traces

### 3.1 Login & Mandatory 2FA (`Login.jsx` + `App.jsx`)
1. Officer enters username + PIN (`Login.jsx:handlePinSubmit`). Client checks memory + encrypted `localStorage` lockout (`5` failures -> `5` minutes).
2. Calls `supabase.auth.signInWithPassword({ email: '<username>@tps.idtl', password })`.
3. Fetches `profiles` and blocks deactivated accounts (`is_active === false`).
4. Invokes Edge Function `send-otp` with caller Bearer JWT -> generates CSPRNG 6-digit OTP, stores SHA-256 hash in `otp_codes`, sends email via Resend.
5. Officer submits 6-digit OTP -> invokes Edge Function `verify-otp` -> calls `verify_and_consume_otp` -> marks OTP used and inserts `verified_2fa_sessions`.
6. Client updates `profiles.last_seen_at`, clears stale IndexedDB cache (`cacheClear()`), and unlocks `<Layout>`.

### 3.2 Bulk File Import (`CsvUploader.jsx` + `excelParser.js`)
1. Accepts `.csv` (PapaParse UTF-8), `.xlsx` (ExcelJS), `.xls` (lazy `xlsx`, `<= 50k` rows), or `.json` up to `15 MB` and `50,000` rows.
2. Strips formula prefixes (`unsanitizeImportedCell`), forward-fills `household_no` & locations, formats Myanmar dates/IDs/suffixes (` ခရိုင်`, ` မြို့နယ်`, ` ရပ်ကွက်`, ` ရွာ`, ` အုပ်စု`), and checks geographic scope (`townshipFilter`/`districtFilter`).
3. Displays row-level Validation Error Modal on any failure, or YES/NO Confirmation Modal on pass.
4. Queries existing rows in 25-household chunks, skips duplicates matching `(household_no + name + dob)`, `taang_land_id_no`, or `previous_id_no`, and batch-inserts remaining rows in 200-row chunks.

### 3.3 Central Database Audited Edit / Delete (`Reports.jsx`)
1. Officer edits member cells inline or triggers Delete on Level 6 (Family Members).
2. Opens modal requiring a **reason** and the officer's **PIN**.
3. Re-verifies PIN via isolated `verifyOfficerPassword()` (`src/lib/supabase.js` — does not touch active 2FA session), inserts `UPDATE_MEMBER` / `DELETE_MEMBER` into `audit_logs`, and executes the `households` mutation.
4. PostgreSQL trigger `trg_audit_households_mutation` independently records `DB_UPDATE_MEMBER` / `DB_DELETE_MEMBER` before/after metadata in `audit_logs`.

### 3.4 Viewer Print / Export Approval (`PopulationStatistics.jsx` / `DemographicDashboard.jsx` -> `NotificationsRequests.jsx`)
1. `viewer` requests Print or Excel export -> inserts `pending` row into `print_export_requests`.
2. Active `system`/`master`/`admin`/`regional` officer hears a Realtime chime in `NotificationsRequests.jsx` and clicks `Approve & Resolve` (`status: 'resolved'`).
3. Viewer receives Realtime `UPDATE`, performs print/export once, and marks row `used`.

---

## 4. Known Incomplete / Missing Workflows
- **Forgot-Password / PIN Reset / Self-Service Password Change UI**: Not implemented (`@tps.idtl` emails cannot use standard email recovery).
- **Citizen Lifecycle Actions**: No UI/schema for household splitting, inter-household relocation/transfer logs, or deceased status flags (all deletes are hard `.delete()` calls).
- **Legacy Access Token Gate**: `tps_access_token` table and RPCs exist in migrations with zero UI callers.
