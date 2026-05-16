# TPS Architecture Vision & Future Roadmap

> **From CRUD App → Long-term Civil Population Lifecycle Management System**
> Immigration Department of Ta'ang Land (IDTL)

---

## 1. Vision Statement

TPS is not just a registration tool — it is the **digital civil registry** for Ta'ang Land. Every person registered today must remain traceable for decades. People are born, marry, move, split households, merge families, and die — the system must model all of this **without ever destroying data**.

### Core Principles

| Principle | Meaning |
|---|---|
| **No hard deletes** | Never `DELETE FROM` a person record. Use status fields instead. |
| **No destructive updates** | Important field changes must preserve the old value (audit trail). |
| **Historical preservation** | Every address, household membership, and status change is a log entry. |
| **Offline resilience** | All workflows must degrade gracefully without connectivity. |
| **Migration-friendly schema** | Today's flat table must evolve into normalized relations without data loss. |
| **Status over deletion** | `status = 'deceased'` not `DELETE`. `status = 'migrated'` not overwrite. |

---

## 2. Current State (Phase 0)

### What We Have Now

```
┌──────────────────────────────────────────┐
│           households (flat table)         │
│                                          │
│  One row = one person                    │
│  Grouped by household_no (text field)    │
│  No person_id separate from row id       │
│  Hard deletes allowed (Reports.jsx)      │
│  Destructive updates (inline edit)       │
│  No status field                         │
│  No audit trail                          │
│  No movement history                     │
└──────────────────────────────────────────┘
```

### Current Risks (Gap Analysis)

| Risk | Where | Impact |
|---|---|---|
| **Hard delete** in Reports.jsx | `supabase.delete().eq('id', ...)` | Permanent data loss — deceased/migrated people vanish |
| **Destructive update** in Reports.jsx | `supabase.update(fields).eq('id', ...)` | Old values lost forever — no audit trail |
| **Person = Row** coupling | `households` table | Cannot track a person across household changes |
| **No `status` field** | Schema | Cannot mark deceased/migrated without deleting |
| **No `updated_at`** | Schema | Cannot know when a record was last modified |
| **No `updated_by`** | Schema | Cannot know who modified a record |
| **Household = text field** | `household_no` column | No first-class household entity; splitting/merging is ad-hoc |
| **Address baked into person** | `ward_village_group`, `township`, `district` on each row | Moving a person = overwrite, losing previous address |

---

## 3. Future Schema (Target State — Phase 2+)

### Entity-Relationship Model

```
┌─────────────┐       ┌──────────────────┐       ┌─────────────┐
│   persons    │       │ household_members │       │  households  │
│              │       │ (junction table)  │       │              │
│  id (PK)     │◄──────│  person_id (FK)   │──────►│  id (PK)     │
│  name        │       │  household_id(FK) │       │  household_no│
│  dob         │       │  relationship     │       │  house_no    │
│  gender      │       │  joined_at        │       │  location_id │
│  father_name │       │  left_at          │       │  status      │
│  mother_name │       │  status           │       │  created_at  │
│  nrc_no      │       │  is_head          │       └─────────────┘
│  taang_id_no │       └──────────────────┘              │
│  nationality │                                         │
│  religious   │       ┌──────────────────┐       ┌──────┴──────┐
│  occupation  │       │  movement_logs    │       │  locations   │
│  status      │       │                  │       │              │
│  created_at  │       │  person_id (FK)   │       │  id (PK)     │
│  updated_at  │       │  from_location_id │       │  name        │
└──────┬───────┘       │  to_location_id   │       │  type (enum) │
       │               │  from_household_id│       │  parent_id   │
       │               │  to_household_id  │       │  township    │
       │               │  reason           │       │  district    │
       │               │  moved_at         │       └─────────────┘
       │               │  recorded_by      │
       │               └──────────────────┘
       │
       │               ┌──────────────────┐
       └──────────────►│  death_records    │
                       │                  │
                       │  person_id (FK)   │
                       │  date_of_death    │
                       │  cause            │
                       │  recorded_by      │
                       │  recorded_at      │
                       └──────────────────┘

       ┌──────────────────┐
       │   audit_logs      │
       │                  │
       │  table_name       │
       │  record_id        │
       │  action (enum)    │
       │  old_values (JSON)│
       │  new_values (JSON)│
       │  performed_by     │
       │  performed_at     │
       └──────────────────┘
```

### Key Enums

```sql
-- Person status
CREATE TYPE person_status AS ENUM (
  'active',      -- alive and present
  'deceased',    -- death recorded
  'migrated',    -- moved out of Ta'ang Land
  'inactive'     -- administratively deactivated
);

-- Household member status
CREATE TYPE membership_status AS ENUM (
  'active',      -- currently living in this household
  'departed',    -- left this household (split/marriage/migration)
  'deceased'     -- died while member of this household
);

-- Location type
CREATE TYPE location_type AS ENUM (
  'ward',        -- ရပ်ကွက်
  'village',     -- ကျေးရွာ
  'group'        -- အုပ်စု
);

-- Movement reason
CREATE TYPE movement_reason AS ENUM (
  'marriage',
  'household_split',
  'relocation',
  'employment',
  'education',
  'family_reunion',
  'other'
);
```

---

## 4. Migration Strategy (Phase 0 → Phase 1 → Phase 2)

### Phase 1: Non-Breaking Additions (DO NOW / NEXT)

Add columns to the existing `households` table without changing any existing code behavior. This is the **immediate next step**.

```sql
-- Phase 1: Add to existing households table
ALTER TABLE households ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
ALTER TABLE households ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE households ADD COLUMN IF NOT EXISTS updated_by TEXT;
ALTER TABLE households ADD COLUMN IF NOT EXISTS person_uuid UUID DEFAULT gen_random_uuid();
```

**Frontend changes for Phase 1:**
- Replace hard `DELETE` with `UPDATE status = 'inactive'` (soft delete)
- Filter queries: add `.eq('status', 'active')` or `.neq('status', 'deceased')`
- On save/edit: set `updated_at = now()` and `updated_by` (when auth exists)
- `person_uuid` gives each person a stable identity for future foreign keys

> [!WARNING]
> **The delete in Reports.jsx (`supabase.delete().eq('id', ...)`) is the #1 thing to change.** Replace it with a soft delete: `supabase.update({ status: 'inactive' }).eq('id', id)`.

### Phase 2: Schema Normalization (FUTURE)

Extract the flat `households` table into normalized relations:

```
Step 1: Create `persons` table — copy person-level fields + person_uuid as PK
Step 2: Create `households` table — unique household_no + location fields
Step 3: Create `household_members` junction — link persons to households
Step 4: Create `locations` table — normalize ward/village/group/township/district
Step 5: Create `movement_logs` — start logging address changes
Step 6: Create `death_records` — formalize death tracking
Step 7: Create `audit_logs` — DB trigger on important tables
Step 8: Backfill from original flat table using person_uuid as key
Step 9: Update frontend components one module at a time
```

### Phase 3: Advanced Civil Registry (LONG-TERM)

- User authentication & role-based access (field officer vs admin)
- Digital signatures on official documents
- Birth registration workflow
- Marriage registration linking two persons
- Inter-district transfer approvals
- Printable official certificates
- Dashboard analytics with time-series population trends

---

## 5. Workflow Designs (Future)

### 5.1 Death Management

```
Officer opens person record
  → Clicks "Record Death"
  → Modal: date of death, cause (optional), confirmation
  → System:
      1. Sets person.status = 'deceased'
      2. Sets household_members.status = 'deceased' + left_at = death date
      3. Creates death_records entry
      4. Creates audit_log entry
      5. Person row is NEVER deleted
      6. Person still appears in historical queries (grayed out)
      7. Statistics exclude deceased from active population counts
```

### 5.2 Population Movement

```
Officer selects person to move
  → Selects destination: district → township → ward/village/group
  → Optionally selects destination household (or creates new one)
  → System:
      1. Creates movement_log (from/to locations, reason, timestamp)
      2. Updates household_members: old membership status = 'departed'
      3. Creates new household_members entry in destination household
      4. Person.status stays 'active'
      5. Old address preserved in movement_log — never overwritten
```

### 5.3 Household Splitting

```
Officer opens source household
  → Clicks "Split Household"
  → Selects members to move (e.g., married son + wife)
  → Enters new household_no for the new household
  → System:
      1. Creates new household record
      2. For each selected member:
         - Old household_members.status = 'departed', left_at = now
         - New household_members entry created (status = 'active')
      3. Movement_log created for each moved member
      4. Original household remains intact (remaining members unaffected)
      5. Cross-reference: new household.parent_household_id = original
```

### 5.4 Household Merging / Member Transfer

```
Officer selects person from household A
  → "Transfer to Household B"
  → System:
      1. household_members row in A: status = 'departed'
      2. New household_members row in B: status = 'active'
      3. Movement_log created
      4. No data deleted from either household
```

---

## 6. Coding Guidelines (Apply Now)

These rules apply to **all new code** even while we're still on the flat `households` table.

### Database Operations

```javascript
// ❌ NEVER — Hard delete
await supabase.from('households').delete().eq('id', id);

// ✅ ALWAYS — Soft delete (status-based)
await supabase.from('households')
  .update({ status: 'inactive', updated_at: new Date().toISOString() })
  .eq('id', id);
```

```javascript
// ❌ AVOID — Destructive update without context
await supabase.from('households').update(fields).eq('id', id);

// ✅ PREFER — Update with timestamp (audit-ready)
await supabase.from('households')
  .update({ ...fields, updated_at: new Date().toISOString() })
  .eq('id', id);
```

```javascript
// ❌ AVOID — Fetching all records without status filter
const { data } = await supabase.from('households').select('*');

// ✅ PREFER — Filter by active status
const { data } = await supabase.from('households')
  .select('*')
  .eq('status', 'active');  // or .neq('status', 'deceased')
```

### Component Design

| Rule | Reason |
|---|---|
| Separate **person identity** from **household context** in UI | Future: persons move between households |
| Show **status badges** (active/deceased/migrated) instead of hiding records | Future: users need to see historical members |
| Keep **edit forms** modular and field-group-based | Future: different fields belong to different tables |
| Use **confirmation modals** for all destructive-seeming actions | UX safety for government data |
| Log **what changed** client-side (even if not yet sent to audit_logs) | Preparation for audit trail |

### Offline Queue

```javascript
// Current retryQueue.js supports: insert, update, delete
// Future additions needed:
//   - 'soft_delete' operation type (update status)
//   - 'transfer' operation type (multi-table transaction)
//   - 'movement' operation type (movement_log + membership updates)
//   - Conflict resolution for concurrent edits
```

---

## 7. Immediate Action Items (Phase 1 Checklist)

> [!IMPORTANT]
> These changes can be made **right now** without breaking anything.

### Database (Supabase Dashboard)

- [ ] Add `status TEXT DEFAULT 'active'` column to `households`
- [ ] Add `updated_at TIMESTAMPTZ DEFAULT now()` column
- [ ] Add `updated_by TEXT` column (for future auth)
- [ ] Add `person_uuid UUID DEFAULT gen_random_uuid()` column
- [ ] Backfill existing rows: `UPDATE households SET status = 'active' WHERE status IS NULL`

### Frontend Code Changes

- [ ] **Reports.jsx** — Replace `supabase.delete()` with soft delete (`update status = 'inactive'`)
- [ ] **Reports.jsx** — Add `updated_at` to edit saves
- [ ] **All queries** — Add `.in('status', ['active'])` or `.neq('status', 'deceased')` filters
- [ ] **PopulationStatistics.jsx** — Exclude deceased/inactive from counts
- [ ] **Verification.jsx** — Show status badge on results, still allow searching deceased
- [ ] **retryQueue.js** — Add `'soft_delete'` operation type

### New Component Prep

- [ ] Create `StatusBadge.jsx` — reusable badge for active/deceased/migrated/inactive
- [ ] Create `RecordDeathModal.jsx` — modal for recording a death (sets status + date)
- [ ] Add "Record Death" action button in family roster views

---

## 8. Data Integrity Rules

| Rule | Enforcement |
|---|---|
| A person record must **never** be hard-deleted | Frontend: no `.delete()`. DB: restrict DELETE via RLS policy |
| Every household must have exactly **one active head** (ဦးစီး) | Validate on insert/edit. Warn if no head or multiple heads. |
| `person_uuid` must be **immutable** once set | Never update this field |
| Status transitions must be **one-directional** | `active → deceased` ✅ / `deceased → active` ❌ (needs admin override) |
| Movement creates **new membership**, never overwrites old | Old membership.status = 'departed', new row created |
| `household_no` must be **unique** per household entity | Currently enforced by convention; future: unique constraint |

---

## 9. Print & Export Considerations

- **Historical reports**: Must be able to generate "population as of date X" — requires `created_at` and status timestamps
- **Death certificates**: Future printable document from `death_records`
- **Migration certificates**: Future printable document from `movement_logs`
- **Household history**: Timeline view showing all members who ever belonged to a household
- **Print format**: Continue using legal landscape (8.5" × 14") for all official documents

---

## 10. Summary: Current vs Future

| Capability | Current (Phase 0) | Phase 1 | Phase 2+ |
|---|---|---|---|
| Person registration | ✅ Flat table | ✅ + status, uuid | ✅ Normalized `persons` |
| Household grouping | Text field (`household_no`) | Same | FK to `households` table |
| Delete member | ❌ Hard delete | ✅ Soft delete (status) | ✅ Status + audit log |
| Edit member | ❌ Destructive update | ✅ + updated_at | ✅ + audit_logs |
| Death tracking | ❌ Not supported | ✅ Status = deceased | ✅ `death_records` table |
| Movement tracking | ❌ Not supported | ❌ Not yet | ✅ `movement_logs` table |
| Household splitting | ❌ Not supported | ❌ Not yet | ✅ Junction table |
| Audit trail | ❌ None | Partial (timestamps) | ✅ Full `audit_logs` |
| Offline support | ✅ Queue + cache | ✅ Same | ✅ + conflict resolution |
| User auth | ❌ None | ❌ Not yet | ✅ Supabase Auth + RLS |

---

> **Think like a government registry, not a CRUD app.**
> Every record is a legal document. Data is never "deleted" — it is archived, annotated, and preserved.

---

*TPS Architecture Vision · IDTL · 2025–2030*
