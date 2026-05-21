-- ═══════════════════════════════════════════════════════════════════════════
-- TPS — Population Statistics: Server-side aggregation RPCs
-- ═══════════════════════════════════════════════════════════════════════════
-- Purpose: scale the /statistics page to 100,000+ records by aggregating
-- in Postgres instead of fetching all rows to the browser.
--
-- HOW TO INSTALL:
--   1. Open Supabase Dashboard → SQL Editor
--   2. Paste this entire file
--   3. Click "Run"
--   4. Verify success messages for each CREATE FUNCTION
--
-- HOW TO TEST (in browser DevTools console while on /statistics):
--   const { data } = await window.supabase.rpc('stats_breakdown', {});
--   console.log(data);
--   -- should print { totalStats: {...}, groupStats: [...], ... }
-- ═══════════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────────────
-- 1. parse_myanmar_date(text) → date
--    Converts Myanmar digits → ASCII and parses "DD.MM.YYYY" or "DD-MM-YYYY".
--    Returns NULL on any failure (never raises).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.parse_myanmar_date(d text)
RETURNS date
LANGUAGE plpgsql IMMUTABLE
AS $$
DECLARE
  s text;
BEGIN
  IF d IS NULL OR btrim(d) = '' THEN RETURN NULL; END IF;
  s := translate(d, '၀၁၂၃၄၅၆၇၈၉', '0123456789');
  IF s ~ '^[0-9]{1,2}\.[0-9]{1,2}\.[0-9]{4}$' THEN
    BEGIN RETURN to_date(s, 'FMDD.FMMM.YYYY'); EXCEPTION WHEN others THEN RETURN NULL; END;
  END IF;
  IF s ~ '^[0-9]{1,2}-[0-9]{1,2}-[0-9]{4}$' THEN
    BEGIN RETURN to_date(s, 'FMDD-FMMM-YYYY'); EXCEPTION WHEN others THEN RETURN NULL; END;
  END IF;
  RETURN NULL;
END;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. classify_wvg(text) → 'ward' | 'village' | 'group' | 'unknown'
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.classify_wvg(v text)
RETURNS text
LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE
    WHEN v IS NULL OR btrim(v) = '' THEN 'unknown'
    WHEN v LIKE '%ရပ်ကွက်%' THEN 'ward'
    WHEN v LIKE '%အုပ်စု%' THEN 'group'
    WHEN v LIKE '%ရွာ%' THEN 'village'
    ELSE 'unknown'
  END;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. split_wvg(text) → table(name text, kind text)
--    Splits comma-separated ward_village_group into individual entries
--    with their classification, ignoring blanks and unknown types.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.split_wvg(s text)
RETURNS TABLE(name text, kind text)
LANGUAGE sql IMMUTABLE
AS $$
  SELECT btrim(p) AS name, public.classify_wvg(btrim(p)) AS kind
  FROM unnest(regexp_split_to_array(COALESCE(s, ''), '[,၊]')) AS p
  WHERE btrim(p) <> '' AND public.classify_wvg(btrim(p)) <> 'unknown';
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. age_bucket(text) → 'u16' | 'b1660' | 'a60' | 'unknown'
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.age_bucket(d text)
RETURNS text
LANGUAGE sql IMMUTABLE
AS $$
  WITH x AS (SELECT public.parse_myanmar_date(d) AS dt)
  SELECT CASE
    WHEN dt IS NULL THEN 'unknown'
    WHEN extract(year from age(dt))::int < 16 THEN 'u16'
    WHEN extract(year from age(dt))::int <= 60 THEN 'b1660'
    ELSE 'a60'
  END
  FROM x;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 5. stats_districts() — distinct districts, sorted
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.stats_districts()
RETURNS TABLE(name text)
LANGUAGE sql STABLE
AS $$
  SELECT DISTINCT district FROM public.households
  WHERE district IS NOT NULL AND district <> ''
  ORDER BY 1;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 6. stats_townships(p_district) — distinct townships in that district
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.stats_townships(p_district text)
RETURNS TABLE(name text)
LANGUAGE sql STABLE
AS $$
  SELECT DISTINCT township FROM public.households
  WHERE district = p_district
    AND township IS NOT NULL AND township <> ''
  ORDER BY 1;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 7. stats_locations(p_district, p_township)
--    All distinct ward/village/group entries within a township, classified.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.stats_locations(p_district text, p_township text)
RETURNS TABLE(name text, kind text)
LANGUAGE sql STABLE
AS $$
  SELECT DISTINCT s.name, s.kind
  FROM public.households h
  CROSS JOIN LATERAL public.split_wvg(h.ward_village_group) s
  WHERE h.district = p_district AND h.township = p_township
  ORDER BY s.kind, s.name;
$$;


-- ═══════════════════════════════════════════════════════════════════════════
-- 8. THE BIG ONE — stats_breakdown(district, township, ward, village, group)
-- ═══════════════════════════════════════════════════════════════════════════
-- Returns a single jsonb object with all data the /statistics page needs:
--   {
--     groupKey: 'district' | 'township' | 'wvg',
--     totalStats: { total, male, female, households, u16m, u16f,
--                   b1660m, b1660f, a60m, a60f, nonLocal,
--                   relCounts: {...}, natCounts: {...} },
--     groupStats: [
--       { name, kind, male, female, total, households, u16m, u16f,
--         b1660m, b1660f, a60m, a60f, nonLocal, relCounts, natCounts },
--       ...
--     ],
--     allReligions: [...],
--     allNationalities: [...]
--   }
--
-- Grouping levels:
--   - no district          → group by district
--   - district only        → group by township
--   - district + township  → group by individual ward/village/group entries
--   - + ward/village/group → only that single entry
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.stats_breakdown(
  p_district text DEFAULT NULL,
  p_township text DEFAULT NULL,
  p_ward     text DEFAULT NULL,
  p_village  text DEFAULT NULL,
  p_group    text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql STABLE
AS $$
  WITH
  -- Determine grouping level from active filters
  vars AS (
    SELECT
      CASE
        WHEN COALESCE(p_township, '') <> '' THEN 'wvg'
        WHEN COALESCE(p_district, '') <> '' THEN 'township'
        ELSE 'district'
      END AS v_group_key,
      COALESCE(NULLIF(p_ward,''), NULLIF(p_village,''), NULLIF(p_group,'')) AS v_loc_name,
      CASE
        WHEN COALESCE(p_ward,'')    <> '' THEN 'ward'
        WHEN COALESCE(p_village,'') <> '' THEN 'village'
        WHEN COALESCE(p_group,'')   <> '' THEN 'group'
      END AS v_loc_kind
  ),
  -- Base data with filters applied
  base AS (
    SELECT
      id, household_no, gender, religious, nationality, resident_status,
      district, township, ward_village_group,
      public.age_bucket(date_of_birth) AS age_b
    FROM public.households, vars
    WHERE (COALESCE(p_district,'') = '' OR district = p_district)
      AND (COALESCE(p_township,'') = '' OR township = p_township)
  ),
  -- Expanded: one row per (person × group) pair
  expanded AS (
    SELECT
      b.*,
      CASE
        WHEN v.v_group_key = 'wvg'      THEN s.name
        WHEN v.v_group_key = 'township' THEN b.township
        ELSE b.district
      END AS gname,
      CASE WHEN v.v_group_key = 'wvg' THEN s.kind ELSE NULL END AS gkind
    FROM base b
    CROSS JOIN vars v
    LEFT JOIN LATERAL public.split_wvg(b.ward_village_group) s
      ON v.v_group_key = 'wvg'
    WHERE
      CASE
        WHEN v.v_group_key = 'wvg' THEN s.name IS NOT NULL AND s.name <> ''
          AND (v.v_loc_name IS NULL OR (s.name = v.v_loc_name AND (v.v_loc_kind IS NULL OR s.kind = v.v_loc_kind)))
        ELSE COALESCE(
          CASE WHEN v.v_group_key = 'township' THEN b.township ELSE b.district END, ''
        ) <> ''
      END
  ),
  -- Distinct religions / nationalities
  distinct_religions AS (
    SELECT COALESCE(jsonb_agg(r ORDER BY r), '[]'::jsonb) AS rels
    FROM (SELECT DISTINCT religious AS r FROM expanded WHERE religious IS NOT NULL AND religious <> '') x
  ),
  distinct_nationalities AS (
    SELECT COALESCE(jsonb_agg(n ORDER BY n), '[]'::jsonb) AS nats
    FROM (SELECT DISTINCT nationality AS n FROM expanded WHERE nationality IS NOT NULL AND nationality <> '') x
  ),
  -- Unique people (deduplicated by id for totals)
  unique_people AS (
    SELECT DISTINCT ON (id)
      id, household_no, gender, religious, nationality, resident_status, age_b
    FROM expanded
  ),
  -- Religion counts (total)
  rel_total AS (
    SELECT jsonb_object_agg(religious, c) AS m FROM (
      SELECT religious, COUNT(*) c FROM unique_people
      WHERE religious IS NOT NULL AND religious <> '' GROUP BY religious
    ) x
  ),
  -- Nationality counts (total)
  nat_total AS (
    SELECT jsonb_object_agg(nationality, c) AS m FROM (
      SELECT nationality, COUNT(*) c FROM unique_people
      WHERE nationality IS NOT NULL AND nationality <> '' GROUP BY nationality
    ) x
  ),
  -- Total stats assembly
  total_stats AS (
    SELECT jsonb_build_object(
      'total',       (SELECT COUNT(*) FROM unique_people),
      'male',        (SELECT COUNT(*) FROM unique_people WHERE gender IN ('ကျား','က')),
      'female',      (SELECT COUNT(*) FROM unique_people WHERE gender = 'မ'),
      'households',  (SELECT COUNT(DISTINCT household_no) FROM unique_people WHERE household_no <> ''),
      'u16m',        (SELECT COUNT(*) FROM unique_people WHERE age_b='u16'   AND gender IN ('ကျား','က')),
      'u16f',        (SELECT COUNT(*) FROM unique_people WHERE age_b='u16'   AND gender='မ'),
      'b1660m',      (SELECT COUNT(*) FROM unique_people WHERE age_b='b1660' AND gender IN ('ကျား','က')),
      'b1660f',      (SELECT COUNT(*) FROM unique_people WHERE age_b='b1660' AND gender='မ'),
      'a60m',        (SELECT COUNT(*) FROM unique_people WHERE age_b='a60'   AND gender IN ('ကျား','က')),
      'a60f',        (SELECT COUNT(*) FROM unique_people WHERE age_b='a60'   AND gender='မ'),
      'unknownAge',  (SELECT COUNT(*) FROM unique_people WHERE age_b='unknown'),
      'nonLocal',    (SELECT COUNT(*) FROM unique_people WHERE resident_status = 'ပြည်နယ်ခြားသား'),
      'relCounts',   COALESCE((SELECT m FROM rel_total), '{}'::jsonb),
      'natCounts',   COALESCE((SELECT m FROM nat_total), '{}'::jsonb)
    ) AS v_total
  ),
  -- Per-group stats
  per_group AS (
    SELECT
      gname,
      MIN(gkind) AS gkind,
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE gender IN ('ကျား','က')) AS male,
      COUNT(*) FILTER (WHERE gender = 'မ') AS female,
      COUNT(DISTINCT household_no) FILTER (WHERE household_no <> '') AS households,
      COUNT(*) FILTER (WHERE age_b='u16'   AND gender IN ('ကျား','က')) AS u16m,
      COUNT(*) FILTER (WHERE age_b='u16'   AND gender='မ') AS u16f,
      COUNT(*) FILTER (WHERE age_b='b1660' AND gender IN ('ကျား','က')) AS b1660m,
      COUNT(*) FILTER (WHERE age_b='b1660' AND gender='မ') AS b1660f,
      COUNT(*) FILTER (WHERE age_b='a60'   AND gender IN ('ကျား','က')) AS a60m,
      COUNT(*) FILTER (WHERE age_b='a60'   AND gender='မ') AS a60f,
      COUNT(*) FILTER (WHERE resident_status = 'ပြည်နယ်ခြားသား') AS non_local
    FROM expanded
    GROUP BY gname
  ),
  -- Religion counts per group
  rel_per_group AS (
    SELECT gname, jsonb_object_agg(religious, c) AS m FROM (
      SELECT gname, religious, COUNT(*) c FROM expanded
      WHERE religious IS NOT NULL AND religious <> '' GROUP BY gname, religious
    ) x GROUP BY gname
  ),
  -- Nationality counts per group
  nat_per_group AS (
    SELECT gname, jsonb_object_agg(nationality, c) AS m FROM (
      SELECT gname, nationality, COUNT(*) c FROM expanded
      WHERE nationality IS NOT NULL AND nationality <> '' GROUP BY gname, nationality
    ) x GROUP BY gname
  ),
  -- Group stats assembly
  group_stats AS (
    SELECT COALESCE(
      jsonb_agg(jsonb_build_object(
        'name',       g.gname,
        'kind',       g.gkind,
        'total',      g.total,
        'male',       g.male,
        'female',     g.female,
        'households', g.households,
        'u16m',       g.u16m,
        'u16f',       g.u16f,
        'b1660m',     g.b1660m,
        'b1660f',     g.b1660f,
        'a60m',       g.a60m,
        'a60f',       g.a60f,
        'nonLocal',   g.non_local,
        'relCounts',  COALESCE(r.m, '{}'::jsonb),
        'natCounts',  COALESCE(n.m, '{}'::jsonb)
      ) ORDER BY g.gname),
      '[]'::jsonb
    ) AS v_groups
    FROM per_group g
    LEFT JOIN rel_per_group r ON r.gname = g.gname
    LEFT JOIN nat_per_group n ON n.gname = g.gname
  )
  -- Final assembly
  SELECT jsonb_build_object(
    'groupKey',         (SELECT v_group_key FROM vars),
    'totalStats',       (SELECT v_total FROM total_stats),
    'groupStats',       (SELECT v_groups FROM group_stats),
    'allReligions',     (SELECT rels FROM distinct_religions),
    'allNationalities', (SELECT nats FROM distinct_nationalities)
  );
$$;


-- ═══════════════════════════════════════════════════════════════════════════
-- ═══════════════════════════════════════════════════════════════════════════
-- REPORTS PAGE — distinct values for navigation
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.report_districts()
RETURNS TABLE (district text) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT h.district
  FROM public.households h
  WHERE h.district IS NOT NULL
  ORDER BY h.district;
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION public.report_townships(p_district text)
RETURNS TABLE (township text) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT h.township
  FROM public.households h
  WHERE h.district = p_district
    AND h.township IS NOT NULL
  ORDER BY h.township;
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION public.report_villages(p_township text)
RETURNS TABLE (village text) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT h.ward_village_group
  FROM public.households h
  WHERE h.township = p_township
    AND h.ward_village_group IS NOT NULL
  ORDER BY h.ward_village_group;
END;
$$ LANGUAGE plpgsql STABLE;

-- PERMISSIONS — allow the anon and authenticated roles to call these
-- ═══════════════════════════════════════════════════════════════════════════
GRANT EXECUTE ON FUNCTION public.stats_districts()                         TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.stats_townships(text)                     TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.stats_locations(text, text)               TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.stats_breakdown(text, text, text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.report_districts()                        TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.report_townships(text)                    TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.report_villages(text)                     TO anon, authenticated;


-- ═══════════════════════════════════════════════════════════════════════════
-- SUGGESTED INDEXES — speed up the aggregation at scale
-- (safe to run multiple times thanks to IF NOT EXISTS)
-- ═══════════════════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_households_district           ON public.households (district);
CREATE INDEX IF NOT EXISTS idx_households_township           ON public.households (township);
CREATE INDEX IF NOT EXISTS idx_households_district_township  ON public.households (district, township);
CREATE INDEX IF NOT EXISTS idx_households_household_no       ON public.households (household_no);
