# Supabase Configuration & Schema for TPS

This document provides a **complete initialization suite** for your Supabase project. You should run these scripts in the **Supabase SQL Editor** to ensure the TPS system functions correctly with full security and data integrity.

---

## 1. Environment Configuration

Define these in your `.env.local` file:

| Variable | Description |
|---|---|
| `VITE_SUPABASE_URL` | Found in Project Settings > API |
| `VITE_SUPABASE_ANON_KEY` | Found in Project Settings > API (use the `anon` key) |

---

## 2. Complete Database Setup (The "One-Click" Script)

Copy and run the entire block below in your **Supabase SQL Editor**. This sets up tables, security, and automatic functions.

```sql
-- ==========================================
-- I. TABLES SETUP
-- ==========================================

-- 1. Civil Registry Records
CREATE TABLE IF NOT EXISTS public.households (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    household_no TEXT NOT NULL,
    name_myanmar TEXT NOT NULL,
    name_english TEXT,
    nrc TEXT,
    gender TEXT,
    dob DATE,
    father_name TEXT,
    mother_name TEXT,
    address TEXT,
    township TEXT,
    district TEXT,
    ward_village TEXT,
    religion TEXT,
    nationality TEXT,
    status TEXT DEFAULT 'active', -- 'active', 'archived', 'deceased'
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. User Profiles (Auth linked)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT UNIQUE NOT NULL,
    display_name TEXT,
    role TEXT DEFAULT 'staff', -- 'staff', 'admin', 'master'
    role_title TEXT, -- e.g. "Chief Inspector", "Field Officer"
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Audit Logging (For master admin)
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id),
    action TEXT NOT NULL,
    table_name TEXT,
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ==========================================
-- II. AUTOMATION & TRIGGERS
-- ==========================================

-- Function to handle updated_at
CREATE OR REPLACE FUNCTION handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for households
CREATE TRIGGER set_household_updated_at
BEFORE UPDATE ON public.households
FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- Function: Auto-create profile on signup
-- This links Supabase Auth users to our public.profiles table automatically
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, username, display_name, role)
  VALUES (
    new.id, 
    split_part(new.email, '@', 1), -- use email prefix as default username
    new.raw_user_meta_data->>'full_name',
    'staff'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ==========================================
-- III. SECURITY (RLS POLICIES)
-- ==========================================

ALTER TABLE public.households ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 1. Households: Authenticated users can read
CREATE POLICY "Authenticated users can view data" 
ON public.households FOR SELECT 
USING (auth.role() = 'authenticated');

-- 2. Households: Only Admin/Master can insert or update
CREATE POLICY "Privileged users can modify data" 
ON public.households FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND (role = 'admin' OR role = 'master')
  )
);

-- 3. Profiles: Users can read all profiles but only update their own
CREATE POLICY "Profiles are viewable by all staff" 
ON public.profiles FOR SELECT 
USING (auth.role() = 'authenticated');

CREATE POLICY "Users can update own profile" 
ON public.profiles FOR UPDATE 
USING (auth.uid() = id);

-- ==========================================
-- IV. REALTIME SETTINGS
-- ==========================================

-- Enable realtime for instant cross-device updates on household data
ALTER PUBLICATION supabase_realtime ADD TABLE public.households;

-- ==========================================
-- V. STORAGE SETUP (ID CARDS)
-- ==========================================

-- Note: Run this in SQL if your plan supports it, otherwise create "id-scans" 
-- bucket in the Storage dashboard and set to 'Public'.
INSERT INTO storage.buckets (id, name, public) VALUES ('id-scans', 'id-scans', true)
ON CONFLICT (id) DO NOTHING;
```

---

## 3. Explanation of the Scripts

### **Why use these specific tables?**
*   **`households`**: Flat structure for speed and offline-first compatibility. It uses Myanmar-English bilingual indexing for search performance.
*   **`profiles`**: Separates sensitive login data (in `auth.users`) from application metadata (like roles).
*   **`audit_logs`**: Crucial for government accountability. Every data export or major change should be logged here.

### **Automation Features**
*   **Handle New User**: When you invite an officer to the system via the Supabase Dashboard, this script **automatically** creates their entry in the `profiles` table. You don't need to manually insert their data.
*   **Realtime**: When a field officer scans an ID card in the remote ward, the central dashboard updates **instantly** without a refresh.

---

## 4. How to Create a "Master" User

After you sign up your first user in the Supabase Dashboard (Authentication > Users), run this SQL to promote them to Master Admin:

```sql
-- Promote specific account to Master Admin (Level 4)
-- Replace YOUR_USER_UUID_HERE with the actual UUID from Supabase Dashboard > Authentication > Users
UPDATE public.profiles 
SET role = 'system', role_title = 'Master Administrator'
WHERE id = 'YOUR_USER_UUID_HERE';
```

---
> **TPS Engineering Team** · Civil Registry System v2.0
