# TPS CSV/JSON Upload Rules & Validation

This document describes all validation rules enforced when uploading household data to the Ta'ang Population System (TPS).

---

## 📁 Supported File Formats

- **CSV** (`.csv`) - Comma-separated values with headers
- **JSON** (`.json`) - Structured JSON export/backup files

---

## 🏠 Household Structure Requirements

### Forward-Fill System
The following fields **auto-forward** from the first row to subsequent rows until changed:
- `Household No.`
- `Ward / Village / Group`
- `Township`
- `District`

**Example:**
```
Row 1: Household A, Ward X, Township Y, District Z → Sets all forward-fill values
Row 2: (blank household_no) → Uses "Household A" from Row 1
Row 3: (blank ward) → Uses "Ward X" from Row 1
Row 4: Ward W → Changes forward-fill ward to "Ward W"
Row 5: (blank ward) → Uses "Ward W" from Row 4
```

---

## 🏘️ Ward / Village / Group Format Rules

The `Ward/Village/Group` field is automatically classified and stored with its type.

### Auto-Detection & Classification

The system **automatically detects** the type based on keywords in the value:

| Contains | Detected Type | Stored As |
|----------|---------------|-----------|
| `ရပ်ကွက်` | Ward (ရပ်) | `ward` |
| `ရွာ` | Village (ရွာ) | `village` |
| `အုပ်စု` | Group (အုပ်စု) | `group` |

### Auto-Correction Feature 🔄
The system **automatically fixes** common spacing errors:

| You Type (Wrong) | System Corrects To (Right) |
|------------------|---------------------------|
| `ကောင်းတပ်ရပ်ကွက်` | `ကောင်းတပ် ရပ်ကွက်` ✅ |
| `အေးချမ်းရွာ` | `အေးချမ်း ရွာ` ✅ |
| `အောင်ချမ်းသာအုပ်စု` | `အောင်ချမ်းသာ အုပ်စု` ✅ |

### Validation Rule (Simplified)

Only requirement: Must contain one of these keywords:
- `ရပ်ကွက်` (Ward)
- `ရွာ` (Village)  
- `အုပ်စု` (Group)

**Error if missing:**
```
Ward/Village/Group: Must contain "ရပ်ကွက်" (Ward), "ရွာ" (Village), or "အုပ်စု" (Group)
```

### Supabase Storage

The system saves TWO fields:

| Field | Example Value | Description |
|-------|---------------|-------------|
| `ward_village_group` | `ကောင်းတပ် ရွာ , အောင်ချမ်းသာ အုပ်စု` | Full name(s) as entered (comma-separated if multiple) |
| `ward_village_group_type` | `{"village", "group"}` | Auto-detected types as **array** |

**SQL to add the column (run in Supabase SQL Editor):**
```sql
-- Change column to support multiple types (array)
ALTER TABLE households 
DROP COLUMN IF EXISTS ward_village_group_type;

-- Add as array type that can hold multiple values
ALTER TABLE households 
ADD COLUMN ward_village_group_type TEXT[] DEFAULT '{}';

-- Create index for array searching
CREATE INDEX idx_ward_type ON households USING GIN (ward_village_group_type);

-- Update existing records to set types as arrays
-- First, reset all to empty
UPDATE households SET ward_village_group_type = '{}';

-- Update records with ရပ်ကွက် (Ward)
UPDATE households 
SET ward_village_group_type = array_append(ward_village_group_type, 'ward')
WHERE ward_village_group LIKE '%ရပ်ကွက်%';

-- Update records with အုပ်စု (Group) - run BEFORE village
UPDATE households 
SET ward_village_group_type = array_append(ward_village_group_type, 'group')
WHERE ward_village_group LIKE '%အုပ်စု%';

-- Update records with ရွာ (Village) - run AFTER group  
UPDATE households 
SET ward_village_group_type = array_append(ward_village_group_type, 'village')
WHERE ward_village_group LIKE '%ရွာ%' 
  AND ward_village_group NOT LIKE '%အုပ်စု%';

-- Verify results - show records with multiple types
SELECT 
  ward_village_group,
  ward_village_group_type,
  array_length(ward_village_group_type, 1) as type_count
FROM households 
WHERE array_length(ward_village_group_type, 1) > 1
LIMIT 10;
```

---

### Multiple Types in One Record (Comma-Separated) 🔄

If a household belongs to **multiple** wards/villages/groups, enter them separated by commas:

**CSV Example:**
```csv
Household No.,Ward / Village / Group,Township,District,Name,...
Family-001,"ကောင်းတပ် ရွာ , အောင်ချမ်းသာ အုပ်စု",Namhsan,Namhsan,John Doe,...
```

**How it works:**
1. System keeps the original comma-separated value in `ward_village_group`
2. Splits and detects type for each part:
   - `ကောင်းတပ် ရွာ` → `village`
   - `အောင်ချမ်းသာ အုပ်စု` → `group`
3. Saves types as **array** in `ward_village_group_type`:
   - `{"village", "group"}`

**Separators supported:**
- Comma: `,`
- Myanmar comma: `၊`

**Query examples:**
```sql
-- Find all village records
SELECT * FROM households WHERE 'village' = ANY(ward_village_group_type);

-- Find records that are BOTH village AND group
SELECT * FROM households 
WHERE 'village' = ANY(ward_village_group_type) 
  AND 'group' = ANY(ward_village_group_type);
```

---

## 📝 Required Fields (Per Member)

These fields **must** be present for each family member:

| Field | Description | Example |
|-------|-------------|---------|
| `Ward/Village/Group` | Village or ward name | `မိုးညှင်းရွာ` |
| `Township` | Township name | `နမ့်ခမ်းဘို` |
| `District` | District name | `ကျောက်မဲခရိုင်` |
| `Gender` | Male/Female | `က` or `ခ` |
| `Household Relationship` | Relationship to head | `အိမ်ထောင်ရှင်` |

**Error:** Upload blocked with missing fields listed per row.

---

## 🆔 ID Requirements (Per Household)

### Rule 1: Ta'ang Land ID Required
- **At least ONE** family member must have a **Ta'ang Land ID No.**
- This ID is issued by IDTL and identifies Ta'ang citizens
- **Error if violated:** `No Ta'ang Land ID: At least one family member must have a Ta'ang Land ID No.`

### Rule 2: Previous ID (NRC) Required
- **At least ONE** family member must have a **Previous ID No.** (Myanmar NRC)
- This is the old Myanmar National Registration Card
- **Error if violated:** `No Previous ID: At least one family member must have a Previous ID No. (NRC).`

**Note:** Having more than 2 Previous IDs per household is allowed but unusual.

---

## 🔤 Myanmar Text Quality Rules

### Fields Checked for Myanmar Text Quality
- `Name`
- `Father's Name`
- `Mother's Name`
- `Household Relationship`
- `Occupation`
- `Nationality`
- `Religious`
- `Ward/Village/Group`
- `Township`
- `District`
- `Resident Status`

### Detected Issues (Upload Blocked)

| Issue | Pattern | Example |
|-------|---------|---------|
| Duplicate medial/modifier | Duplicate `ျ` `ြ` `ွ` `ှ` | `ကျျ` |
| Duplicate vowel sign | Duplicate `ါ` `ာ` `ိ` `ီ` `ု` `ူ` `ေ` `ဲ` | `ကားာ` |
| Duplicate virama | Double `်` | `က္္` |
| Repeated dot below | Multiple `့` | `ကို့့` |
| Repeated visarga | Multiple `း` | `ကိုးး` |
| Multiple `ေ` in sequence | `ေ...ေ` | `ကေကြ` |
| Invalid stacking | `္` not followed by consonant | `က္1` |
| Stacking mark at end | `္` at text end | `က္` |
| Latin mixed with Myanmar | English letters in Myanmar word | `ကa` |

**Error:** `⚠ Data Validation Errors: [Field]: "[Value]" ([Issue])`

---

## 🔄 Duplicate Detection

Records are checked against existing database entries using these matching fields:
- `name`
- `household_no`
- `date_of_birth`
- `gender`
- `fathers_name`
- `previous_id_no`

**Behavior:** Duplicates are **skipped** (not re-inserted). Other valid records continue processing.

---

## 🖼️ Complete CSV Column Headers

```
Household No.
Name
Date of birth
Gender
Father's Name
Mother's Name
Household Relationship
Occupation
Previous ID No.
Ta'ang Land ID No.
Nationality
Resident Status
Religious
House NO.
Ward / Village / Group
Township
District
Submission Date
```

---

## ⚠️ Error Modal Format

When validation fails, an error modal displays:

| Column | Content |
|--------|---------|
| **Excel Row** | Row number in source file (2 = first data row after header) |
| **Name** | Person's name or `Household: [household_no]` |
| **Issue(s)** | Missing fields (tagged) and/or Myanmar text errors (listed) |

---

## ✅ Successful Upload

After successful validation and insertion:
- Message: `Inserted X new records | Skipped Y duplicates`
- Push notification sent to system
- `onUploadSuccess` callback triggered

---

## 📊 Limits

| Limit | Value |
|-------|-------|
| Max records per upload | Unlimited (processed sequentially) |
| Max duplicates tracked | All (reported in success message) |
| Myanmar text errors | Upload blocked until fixed |
| ID requirement failures | Upload blocked until fixed |
| DB errors | Reported but don't stop processing |

---

## 🛠️ Troubleshooting

**"No Ta'ang Land ID" error:**
- Add Ta'ang Land ID to at least one family member in the household
- Check that the ID is in the `Ta'ang Land ID No.` column

**"No Previous ID" error:**
- Add Previous ID (NRC) to at least one family member
- Format example: `၁၃/နခန(နိုင်)၀၉၆၉၁၅`

**"Myanmar Text Errors":**
- Open CSV in Excel and check the flagged field
- Retype the text cleanly in Unicode Myanmar
- Remove any stray English characters or duplicate marks

**"Missing Fields":**
- Ensure forward-fill columns are set in first row of each household
- Check that no required field columns are empty

---

*Last updated: May 15, 2026*
