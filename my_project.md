# TPS — Ta'ang Population System

> **Official Population Registration & Management System**
> Built for the **Immigration Department of Ta'ang Land (IDTL)**
> Ta'ang Land · Northern Shan State · Myanmar

---

## Table of Contents

- [Project Overview](#project-overview)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Frontend](#frontend)
- [Backend (BaaS)](#backend-baas)
- [Offline-First Architecture](#offline-first-architecture)
- [Application Modules & Workflows](#application-modules--workflows)
- [Data Model](#data-model)
- [Project Structure](#project-structure)
- [Deployment](#deployment)
- [Production Scale](#production-scale)

---

## Project Overview

**TPS (Ta'ang Population System)** is a full-featured internal web application used by ~85 field officers and administrators to manage civil immigration records across the TNLA-administered Ta'ang region. It handles:

- **Household registration** — registering families with household numbers, members, and addresses
- **Population census** — tracking population by district / township / ward / village / group
- **Ta'ang Land ID issuance** — issuing new Ta'ang Land identity cards
- **ID card scanning & verification** — scanning QR codes on issued ID cards to verify identity
- **Data verification** — verifying citizens against the database
- **Statistics & reports** — population breakdowns by location, age, gender, religion, nationality

The UI is fully bilingual (**Myanmar script ဗမာစာ** + English) and designed for both desktop and mobile/tablet use in remote areas with intermittent connectivity.

---

## Tech Stack

### Frontend

| Technology | Version | Purpose |
|---|---|---|
| **React** | 19.x | UI framework (SPA) |
| **Vite** | 8.x | Build tool & dev server |
| **React Router DOM** | 7.x | Client-side routing |
| **Tailwind CSS** | 3.x | Utility-first CSS styling |
| **Lucide React** | 1.x | Icon library |
| **PostCSS + Autoprefixer** | — | CSS processing |

### Backend-as-a-Service (BaaS)

| Technology | Purpose |
|---|---|
| **Supabase** | PostgreSQL database, real-time subscriptions, REST API |

### Libraries & Utilities

| Library | Purpose |
|---|---|
| **PapaParse** | CSV file parsing for bulk data upload |
| **xlsx (SheetJS)** | Excel file reading (ExcelChecker) and export |
| **jsQR** | QR code detection from camera frames |
| **qrcode** | QR code generation |
| **html5-qrcode** | Alternative QR scanning library |
| **rabbit-node** | Zawgyi → Unicode Myanmar font conversion |
| **JSZip** | ZIP file handling |

### PWA & Offline

| Technology | Purpose |
|---|---|
| **vite-plugin-pwa** | Service worker generation & PWA manifest |
| **Workbox** | Runtime caching strategy (NetworkFirst for Supabase API) |
| **IndexedDB** | Client-side offline read cache (24h TTL) |
| **localStorage** | Retry queue for failed writes + notification store |

### Fonts

| Font | Usage |
|---|---|
| **Inter** | Primary UI font (Latin) |
| **Public Sans** | Bold headings |
| **Pyidaungsu / Myanmar Text** | Myanmar script rendering (system fonts) |
| **Custom TTF** | Bundled font (`my-font.ttf`) for official documents |

### Deployment

| Platform | Purpose |
|---|---|
| **Vercel** | Static hosting with SPA rewrites |
| **GitHub** | Version control (`Naung-Kendrick/TPS`) |

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     BROWSER (PWA)                       │
│                                                         │
│  ┌─────────────┐  ┌───────────────┐  ┌──────────────┐  │
│  │  React SPA   │  │ Service Worker│  │  IndexedDB   │  │
│  │  (Vite)     │  │  (Workbox)    │  │ Offline Cache│  │
│  └──────┬──────┘  └───────┬───────┘  └──────┬───────┘  │
│         │                 │                  │          │
│         │    ┌────────────┴─────┐            │          │
│         │    │  Retry Queue     │            │          │
│         │    │  (localStorage)  ├────────────┘          │
│         │    └────────┬─────────┘                       │
└─────────┼─────────────┼─────────────────────────────────┘
          │             │
          ▼             ▼
┌─────────────────────────────────────────────────────────┐
│                    SUPABASE (BaaS)                       │
│                                                         │
│  ┌─────────────┐  ┌───────────────┐  ┌──────────────┐  │
│  │ PostgreSQL   │  │ REST API      │  │ Realtime     │  │
│  │ Database     │  │ (PostgREST)   │  │ (WebSocket)  │  │
│  └─────────────┘  └───────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────┘
```

> [!IMPORTANT]
> This is a **frontend-only** project — there is **no custom backend server**. All server-side operations (database, auth, real-time) are handled by **Supabase** as a Backend-as-a-Service.

---

## Frontend

### Routing (`react-router-dom`)

All routes are nested under a shared `<Layout>` with sidebar navigation:

| Route | Component | Description |
|---|---|---|
| `/` | → Redirects to `/verification` | Default landing page |
| `/verification` | `Verification.jsx` | Search & verify household records |
| `/upload` | `CsvUploader.jsx` + `ExcelChecker.jsx` | Bulk import from CSV/JSON/Excel |
| `/scanner` | `IDCardScanner.jsx` | QR code camera scanner + manual ID lookup |
| `/statistics` | `PopulationStatistics.jsx` | Population statistics with filters & charts |
| `/registration` | `HouseholdForm.jsx` | Manual household member registration form |
| `/central-database` | `Reports.jsx` | Hierarchical drill-down database browser |
| `/settings` | Placeholder | Under development |

### Code Splitting

Every page-level component is **lazy-loaded** using `React.lazy()` + `Suspense`, so each route is a separate JS chunk for optimal loading performance.

### Layout System

- **Desktop**: Sticky 240px sidebar with navigation + IDTL branding
- **Mobile** (`< 768px`):
  - Fixed top branding bar (48px)
  - Bottom navigation bar (60px) with 4 primary tabs + "More" overflow sheet
  - Swipe gestures for page navigation (left/right swipe between pages)
  - Drawer sidebar (accessible via left-edge swipe)

### Design System

- **Monochrome government aesthetic**: `#1A1A1A` primary, `#737373` secondary, `#E5E7EB` borders
- **No border-radius** — all elements use sharp 0px corners (official document style)
- **Watermark**: IDTL logo displayed at 8% opacity in bottom-right corner
- **Myanmar numerals** (၀-၉) used throughout statistics and date displays

---

## Backend (BaaS)

### Supabase Configuration

```
Environment Variables (in .env.local):
  VITE_SUPABASE_URL     → Supabase project URL
  VITE_SUPABASE_ANON_KEY → Supabase anonymous API key
```

The Supabase client is initialized in `src/lib/supabase.js` and imported by all components that need database access.

### Database Table: `households`

A single flat table stores all individual records. Each row = one person. Households are grouped by `household_no`.

### Supabase Features Used

| Feature | Where Used |
|---|---|
| **REST API** (`.select()`, `.insert()`, `.update()`, `.delete()`) | All CRUD operations |
| **Real-time Subscriptions** (`.channel().on('postgres_changes')`) | `Reports.jsx` — live family roster updates |
| **`.ilike()` fuzzy search** | `Verification.jsx` — multi-field search |
| **`.eq()` exact match** | ID scanner lookup, family roster queries |
| **`.maybeSingle()`** | ID scanner — returns null instead of error if not found |
| **`{ count: 'exact', head: true }`** | `HouseholdForm.jsx` — efficient family member count |

---

## Offline-First Architecture

### 1. Service Worker (Workbox via `vite-plugin-pwa`)

- **App shell** (JS, CSS, HTML, fonts, images) cached with `globPatterns`
- **Supabase API responses** cached with `NetworkFirst` strategy (5s timeout, falls back to cache, 24h expiry)
- **Fonts** cached with `CacheFirst` strategy (365-day expiry)
- PWA manifest enables "Add to Home Screen" for mobile officers

### 2. Offline Read Cache (`src/lib/offlineCache.js`)

- Uses **IndexedDB** (`tps_offline_cache` database)
- `cacheSet(key, data)` — stores query results with timestamp
- `cacheGet(key)` — returns cached data if < 24h old
- Used in `Reports.jsx` for stale-while-revalidate pattern

### 3. Retry Queue (`src/lib/retryQueue.js`)

- Uses **localStorage** (`tps_retry_queue`)
- When a Supabase write fails (offline or network error), the operation is queued
- On app startup or `online` event, queued operations are automatically replayed
- Supports `insert`, `update`, and `delete` operation types

### 4. Online/Offline Detection (`src/main.jsx`)

- Listens to `window.addEventListener('online'/'offline')`
- Automatically drains retry queue when connectivity returns
- Shows toast notifications for connectivity changes

---

## Application Modules & Workflows

### 1. Data Verification (`/verification`)

```
User fills in search fields (any combination)
    ↓
Supabase `.ilike()` query with all non-empty fields
    ↓
Results table displayed (up to 50 matches)
    ↓
User clicks "VIEW FAMILY" on a result
    ↓
Inline family roster expands (fetches all members with same household_no)
    ↓
Can Print PDF or Export Excel for the household
```

**Key features:**
- 10 search fields including NRC (Previous ID) 4-part format
- Myanmar numeral → Arabic conversion for age calculation
- Family roster with member stats (male/female counts, age groups)

### 2. Data Upload (`/upload`)

```
User uploads CSV or JSON file
    ↓
PapaParse (CSV) or JSON.parse processes the file
    ↓
Zawgyi → Unicode conversion (rabbit-node)
    ↓
Ward/Village/Group auto-correction (adds missing spaces)
    ↓
Strict validation:
  - Required fields check
  - Myanmar text quality (duplicate vowels, invalid stacking, mixed encoding)
  - Ward/Village/Group format (must contain ရပ်ကွက်, ရွာ, or အုပ်စု)
  - Household-level ID requirements (≥1 Ta'ang ID, ≥1 Previous ID per household)
    ↓
If errors → Modal shows all errors (blocked upload)
If valid → Duplicate check → Supabase insert row-by-row
    ↓
Success notification with counts (inserted / skipped duplicates / errors)
```

**Supported formats:**
- **CSV**: Standard columnar format with forward-filling for household_no
- **JSON**: Nested household structure `{ household_id, location, members[] }`

### 3. ID Card Scanner (`/scanner`)

```
Mode 1: Manual Entry
  User types Ta'ang Land ID number → Search button → Supabase lookup

Mode 2: QR Camera Scan
  Camera opens fullscreen → jsQR decodes QR from video frames
    ↓
  QR data extracted → Numeric ID parsed (handles "No - 01003..." format)
    ↓
  Supabase lookup (exact match → fallback to ilike partial match)
    ↓
  Verification result card with:
    - VERIFIED stamp header
    - Unique verification reference (TPS-VRF-YYYYMMDD-XXXXXX)
    - Identity details (name, ID, DOB, gender, etc.)
    - Address details
    - "View All Family Members" button → modal with full roster
```

**Camera features:**
- Fullscreen camera overlay with card alignment frame
- Animated scan line
- Zoom control (1x–4x, CSS + hardware zoom)
- Corner bracket alignment guides

### 4. Population Statistics (`/statistics`)

```
On mount → Fetch all records from Supabase (selected columns only)
    ↓
Location filters: District → Township → Ward / Village / Group
    ↓
Compute on client-side:
  - Total population, male, female, household count
  - Age distribution (under 16, 16-60, above 60) with gender split
  - Religious breakdown (horizontal bar chart)
  - Nationality breakdown (horizontal bar chart)
  - Comprehensive summary tables with pagination (25 rows/page)
    ↓
Print PDF (legal landscape 8.5" × 14") or Export Excel
```

**Tables generated:**
- **Table 1**: Population + Age by Gender + Religious breakdown per location
- **Table 2**: Population + Nationality breakdown per location
- Separate tables for Wards, Villages, and Groups when at township level

### 5. Household Registration (`/registration`)

```
User clicks "+ ADD MEMBER" → Modal form opens
    ↓
Fill 17 fields:
  Household No. (auto-fills shared fields if existing household found)
  Name, DOB (Myanmar calendar), Gender, Father/Mother's name
  Relationship (dropdown + custom), Occupation
  Previous ID No., Ta'ang Land ID No.
  Nationality, Resident Status, Religious (dropdown + custom)
  House No., Ward/Village/Group (auto-corrected), Township, District
  Submission Date (Myanmar calendar picker)
    ↓
Submit options:
  "SAVE & ADD NEXT MEMBER" — keeps household fields, clears personal fields
  "SAVE & CLOSE" — resets everything and closes modal
    ↓
If online → Supabase insert
If offline → Queued to retry queue (localStorage)
    ↓
Auto-save draft to localStorage (restored on page reload)
```

### 6. Central Database (`/central-database`)

```
Level 1: All Districts (card grid)
  → Click district
Level 2: Townships in that district
  → Click township
Level 3: Wards/Villages/Groups in that township
  → Click ward/village/group
Level 4: Household Heads (table: name, HH no., gender, occupation)
  → Click "View Family"
Level 5: Full family roster (inline editable table)
  → Edit any field inline
  → Delete member (with confirmation modal)
  → Print PDF / Export Excel / Export JSON
```

**Special features:**
- Breadcrumb navigation with clickable levels
- Search filter at every level
- Real-time subscription at Level 5 (live updates when another user adds/edits/deletes)
- Offline cache with stale-while-revalidate pattern
- Export All JSON (bulk export of all records at current filter level)

---

## Data Model

### `households` Table Schema

| Column | Type | Description |
|---|---|---|
| `id` | UUID | Primary key (auto-generated) |
| `household_no` | text | Household number (e.g., "မနမ-၁") |
| `name` | text | Person's full name |
| `date_of_birth` | text | DOB in Myanmar format (e.g., "၁.၅.၁၉၉၀") |
| `gender` | text | "ကျား" (Male) or "မ" (Female) |
| `fathers_name` | text | Father's name |
| `mothers_name` | text | Mother's name |
| `household_relationship` | text | Relationship to head (ဦးစီး, ဇနီး, သား, etc.) |
| `occupation` | text | Occupation |
| `previous_id_no` | text | Myanmar NRC number |
| `taang_land_id_no` | text | Ta'ang Land issued ID number |
| `nationality` | text | Nationality (default: "တအာင်း") |
| `resident_status` | text | "တအာင်း" or "ပြည်နယ်ခြားသား" |
| `religious` | text | Religion |
| `house_no` | text | House number |
| `ward_village_group` | text | Ward / Village / Group name(s) |
| `ward_village_group_type` | text[] | Array of types: `['ward']`, `['village']`, `['group']` |
| `township` | text | Township name |
| `district` | text | District name |
| `submission_date` | text | Date the record was submitted |
| `address` | text | Concatenated full address |
| `created_at` | timestamp | Auto-generated creation timestamp |

### Administrative Hierarchy

```
District (ခရိုင်) — 4 total
  └── Township (မြို့နယ်) — 8 total
        └── Ward (ရပ်ကွက်) / Village (ကျေးရွာ) / Group (အုပ်စု) — ~850 total
              └── Household (အိမ်ထောင်စု)
                    └── Members (အိမ်ထောင်စုဝင်)
```

### ID Types

| ID Type | Field | Description |
|---|---|---|
| Previous ID (NRC) | `previous_id_no` | Old Myanmar National Registration Card (format: `၁၃/နခန(နိုင်)၀၉၆၉၁၅`) |
| Ta'ang Land ID | `taang_land_id_no` | New Ta'ang Land-issued identity number |

---

## Project Structure

```
TPS/
├── index.html              # Entry HTML with responsive meta tags & mobile CSS
├── package.json            # Dependencies & scripts
├── vite.config.js          # Vite + React + PWA configuration
├── tailwind.config.js      # Tailwind with custom colors & Myanmar fonts
├── postcss.config.js       # PostCSS pipeline
├── vercel.json             # Vercel SPA rewrite rules
├── .env.local              # Supabase URL + Anon Key (gitignored)
├── CSV_UPLOAD_RULES.md     # Documentation for CSV upload rules
│
├── public/
│   └── icons/              # PWA icons (192x192, 512x512)
│
├── src/
│   ├── main.jsx            # App entry — BrowserRouter, offline sync, event listeners
│   ├── App.jsx             # Route definitions with lazy-loading
│   ├── App.css             # App-level CSS
│   ├── index.css           # Global styles & CSS variables
│   │
│   ├── assets/
│   │   ├── fonts/
│   │   │   ├── IDTL_logo.png       # Official IDTL seal/logo
│   │   │   └── my-font.ttf         # Custom Myanmar font for print
│   │   ├── logo.jpg                # Project logo
│   │   └── taang_flag.jpg          # Ta'ang flag image
│   │
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Layout.jsx          # App shell (sidebar + main + watermark + swipe)
│   │   │   ├── Sidebar.jsx         # Desktop sidebar + mobile bottom nav + drawer
│   │   │   ├── Topbar.jsx          # Top bar component
│   │   │   └── DashboardOverview.jsx # Dashboard overview component
│   │   │
│   │   ├── Verification.jsx        # Data verification search & results
│   │   ├── CsvUploader.jsx         # CSV/JSON bulk upload with validation
│   │   ├── ExcelChecker.jsx        # Excel file validator & preview
│   │   ├── IDCardScanner.jsx       # QR camera scanner + manual ID lookup
│   │   ├── PopulationStatistics.jsx # Statistics dashboard with charts & tables
│   │   ├── HouseholdForm.jsx       # Manual household registration form
│   │   ├── Reports.jsx             # Central database browser (5-level drill-down)
│   │   ├── HouseholdTable.jsx      # Reusable household table component
│   │   ├── EditHouseholdModal.jsx   # Household editing modal
│   │   ├── EmptyState.jsx          # Empty/error/offline state placeholder
│   │   └── Skeleton.jsx            # Loading skeleton components
│   │
│   └── lib/
│       ├── supabase.js             # Supabase client initialization
│       ├── offlineCache.js         # IndexedDB offline read cache
│       ├── retryQueue.js           # localStorage write retry queue
│       ├── notifications.js        # Client-side notification store + Web Audio sounds
│       ├── householdPrint.js       # Household PDF print & Excel export
│       ├── statisticsPrint.js      # Statistics PDF print & Excel export
│       └── exportFilename.js       # Smart export filename builder
│
└── dist/                           # Production build output (gitignored)
```

---

## Deployment

### Development

```bash
npm run dev          # Start Vite dev server (localhost:5173)
```

### Production Build

```bash
npm run build        # Output to dist/
npm run preview      # Preview production build locally
```

### Vercel Deployment

- Hosted on **Vercel** with automatic GitHub deployments from `main` branch
- `vercel.json` configures SPA catch-all rewrite: all routes → `/index.html`
- Environment variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) configured in Vercel dashboard

### GitHub Repository

```
https://github.com/Naung-Kendrick/TPS.git
Branch: main
```

---

## Production Scale

| Dimension | Count |
|---|---|
| Districts | 4 |
| Townships | 8 |
| Wards / Villages / Groups | ~850 |
| Population records | 100,000+ |
| Total users (field officers + admins) | ~85 |

### Key Performance Considerations

- **Pagination**: Statistics tables paginate at 25 rows/page on screen, 40 rows/page on print
- **Print format**: Legal landscape (8.5" × 14") for all official documents
- **Data queries**: Fetch only needed columns (never `SELECT *` on full dataset for stats)
- **Client-side compute**: Acceptable on admin desktops; mobile performance is prioritized
- **Offline-first**: Critical for field officers working in remote areas

---

## Notification System

The app includes a custom notification system (`src/lib/notifications.js`) with:

- **Types**: sync, upload, verification, online, offline, info, warning, error
- **Storage**: localStorage-based (up to 50 notifications)
- **Sound**: Web Audio API tones (no audio files needed) — different tones for success, warning, error
- **Events**: Custom `tps:notifications` event for real-time UI updates

---

## Myanmar Text Handling

| Feature | Implementation |
|---|---|
| **Zawgyi → Unicode** | `rabbit-node` library (`zg2uni`) auto-converts during upload |
| **Myanmar numeral display** | Custom `toMyanmarNum()` function throughout |
| **Myanmar calendar** | Custom `MyanmarCalendar` React component for date input |
| **Text validation** | Checks for duplicate medials, invalid stacking, mixed encoding |
| **Ward/Village auto-correct** | Automatically adds missing space before suffixes (ရပ်ကွက်, ရွာ, အုပ်စု) |

---

## Future Vision & Roadmap

TPS is designed to evolve from a registration tool into a **full civil population lifecycle management system**. The long-term architecture supports:

- **Death management** — deceased members are never deleted, only status-marked
- **Population movement tracking** — migration history preserved across locations
- **Household splitting & merging** — when families grow, divide, or combine
- **Full audit trail** — every change logged with old values, timestamps, and editor info
- **Schema normalization** — migration from flat table to `persons`, `households`, `household_members`, `movement_logs`, `death_records`, `audit_logs`

> 📄 **See [TPS_ARCHITECTURE_VISION.md](./TPS_ARCHITECTURE_VISION.md)** for the complete architecture vision, future schema design, migration strategy, coding guidelines, and immediate action items.

### Core Principle

> *Think like a government registry, not a CRUD app. Every record is a legal document — data is never "deleted", only archived, annotated, and preserved.*

---

> **TPS** — *Ta'ang Population System* · IDTL · 2025
