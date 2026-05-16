# TPS Role & Login System Architecture

This document outlines the authentication and authorization architecture for the Ta'ang Population System (TPS). Because TPS handles sensitive immigration and civil registry data, it utilizes a strict, closed-loop authentication system backed by Supabase.

---

## 1. Authentication Architecture

TPS uses a **Closed Registration Model**. Field officers cannot sign up by themselves; accounts must be provisioned by a System Administrator.

### Internal Domain Mapping
To maintain security and prevent external accounts from polluting the database, the system uses an internal domain: `@tps.idtl`.
* **Login Form:** The user only types their username (e.g., `zaw.myint`).
* **Under the Hood:** The React app automatically appends `@tps.idtl` and sends `zaw.myint@tps.idtl` to Supabase Auth.
* **Passwords:** Referred to as "PIN Codes" in the UI for ease of use by field staff, but they act as standard secure passwords (minimum 6 characters).

### Dual-Table Setup
Authentication relies on two synchronized tables:
1. `auth.users`: The secure, hidden Supabase table that stores emails (`@tps.idtl`) and encrypted passwords.
2. `public.profiles`: A public-facing table that links to `auth.users` via the UUID. It stores the user's `username`, `display_name`, and `role`.

*The Login process authenticates against table #1, and then immediately reads table #2 to determine the user's permissions.*

---

## 2. System Roles (RBAC)

The system enforces 4 hierarchical tiers of access control. 

| Role Level | Database Key | Description & Permissions |
| :--- | :--- | :--- |
| **Level 1** | `field` | **Field Staff.** Standard data entry and identity verification. Cannot upload bulk data or manage users. |
| **Level 2** | `ops` | **Operations.** Access to bulk CSV upload capabilities and data correction tools. |
| **Level 3** | `regional` | **Regional Admin.** Access to comprehensive population statistics, reports, and district-level aggregations. |
| **Level 4** | `system` | **System Admin (Master).** Full architectural control. The *only* role permitted to access the **User Management** panel to provision new staff accounts. |

### UI Enforcement
In the React application (`Sidebar.jsx`), roles dictate which navigation items are visible:
* `User Management` is only visible to `system` (or legacy `master`/`admin`).
* `Data Upload` is hidden from `field` staff.

---

## 3. User Provisioning Workflow (Edge Function)

To create new accounts without requiring email confirmation or risking exposure of the `service_role` key to the frontend, TPS uses a **Supabase Edge Function** (`create-user`).

**The Workflow:**
1. A **System Admin** logs into the React app and navigates to User Management.
2. They fill out the form (Username, Password, Display Name, Role).
3. The React app sends a secure POST request to the Edge Function.
4. The Edge Function runs on the server, using the high-privilege `SUPABASE_SERVICE_ROLE_KEY`.
5. It forces the creation of the user in `auth.users` (bypassing email verification).
6. It immediately performs an `upsert` on the `public.profiles` table to assign the correct `role`.

---

## 4. Security & Row Level Security (RLS)

The database is fortified using Postgres Row Level Security (RLS). 

* **Default Deny:** By default, if RLS is enabled, no one can read or write any data.
* **Profile Reading:** A specific policy exists: `USING (auth.role() = 'authenticated')`. This ensures only logged-in users can read the `profiles` table to verify roles. Unauthenticated internet traffic is blocked.
* **Data Protection:** Future tables (like `households`) should have policies that allow `SELECT` for all authenticated users, but restrict `INSERT`/`UPDATE`/`DELETE` to specific roles (e.g., `USING ( role = 'system' OR role = 'ops' )`).

---

## 5. Troubleshooting Login Failures

If a user cannot log in, the `Login.jsx` component provides specific error codes:

1. **"Invalid username or PIN"**: Supabase Auth rejected the credentials. The password is wrong, or the user was accidentally created with a different domain (e.g., `@gmail.com` instead of `@tps.idtl`).
2. **"Pending email confirmation"**: The Supabase project settings require email verification. This must be turned OFF in the Supabase Dashboard.
3. **"Profile is missing or blocked (PGRST116)"**: The password was correct, but the database could not find the user's role in the `profiles` table. This happens if the account was created manually in Supabase without running the proper SQL `INSERT` to link the profile, or if RLS policies are missing.
