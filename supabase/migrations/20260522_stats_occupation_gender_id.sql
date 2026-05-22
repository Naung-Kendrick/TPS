-- ═══════════════════════════════════════════════════════════════════════════
-- TPS — Add occupation counts, gender counts, and ID card holder count
--       to the stats_breakdown RPC totalStats payload.
--
-- HOW TO INSTALL:
--   1. Open Supabase Dashboard → SQL Editor
--   2. Paste this entire file and click "Run"
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
  base AS (
    SELECT
      id, household_no, gender, religious, nationality, resident_status,
      occupation, taang_land_id_no,
      district, township, ward_village_group,
      public.age_bucket(date_of_birth) AS age_b
    FROM public.households, vars
    WHERE (COALESCE(p_district,'') = '' OR district = p_district)
      AND (COALESCE(p_township,'') = '' OR township = p_township)
  ),
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
  distinct_religions AS (
    SELECT COALESCE(jsonb_agg(r ORDER BY r), '[]'::jsonb) AS rels
    FROM (SELECT DISTINCT religious AS r FROM expanded WHERE religious IS NOT NULL AND religious <> '') x
  ),
  distinct_nationalities AS (
    SELECT COALESCE(jsonb_agg(n ORDER BY n), '[]'::jsonb) AS nats
    FROM (SELECT DISTINCT nationality AS n FROM expanded WHERE nationality IS NOT NULL AND nationality <> '') x
  ),
  distinct_occupations AS (
    SELECT COALESCE(jsonb_agg(o ORDER BY o), '[]'::jsonb) AS occs
    FROM (SELECT DISTINCT occupation AS o FROM expanded WHERE occupation IS NOT NULL AND occupation <> '') x
  ),
  unique_people AS (
    SELECT DISTINCT ON (id)
      id, household_no, gender, religious, nationality, resident_status,
      occupation, taang_land_id_no, age_b
    FROM expanded
  ),
  rel_total AS (
    SELECT jsonb_object_agg(religious, c) AS m FROM (
      SELECT religious, COUNT(*) c FROM unique_people
      WHERE religious IS NOT NULL AND religious <> '' GROUP BY religious
    ) x
  ),
  nat_total AS (
    SELECT jsonb_object_agg(nationality, c) AS m FROM (
      SELECT nationality, COUNT(*) c FROM unique_people
      WHERE nationality IS NOT NULL AND nationality <> '' GROUP BY nationality
    ) x
  ),
  occ_total AS (
    SELECT jsonb_object_agg(occupation, c) AS m FROM (
      SELECT occupation, COUNT(*) c FROM unique_people
      WHERE occupation IS NOT NULL AND occupation <> '' GROUP BY occupation
    ) x
  ),
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
      'withId',      (SELECT COUNT(*) FROM unique_people WHERE taang_land_id_no IS NOT NULL AND btrim(taang_land_id_no) <> ''),
      'relCounts',   COALESCE((SELECT m FROM rel_total), '{}'::jsonb),
      'natCounts',   COALESCE((SELECT m FROM nat_total), '{}'::jsonb),
      'occCounts',   COALESCE((SELECT m FROM occ_total), '{}'::jsonb)
    ) AS v_total
  ),
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
  rel_per_group AS (
    SELECT gname, jsonb_object_agg(religious, c) AS m FROM (
      SELECT gname, religious, COUNT(*) c FROM expanded
      WHERE religious IS NOT NULL AND religious <> '' GROUP BY gname, religious
    ) x GROUP BY gname
  ),
  nat_per_group AS (
    SELECT gname, jsonb_object_agg(nationality, c) AS m FROM (
      SELECT gname, nationality, COUNT(*) c FROM expanded
      WHERE nationality IS NOT NULL AND nationality <> '' GROUP BY gname, nationality
    ) x GROUP BY gname
  ),
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
  SELECT jsonb_build_object(
    'groupKey',         (SELECT v_group_key FROM vars),
    'totalStats',       (SELECT v_total FROM total_stats),
    'groupStats',       (SELECT v_groups FROM group_stats),
    'allReligions',     (SELECT rels FROM distinct_religions),
    'allNationalities', (SELECT nats FROM distinct_nationalities),
    'allOccupations',   (SELECT occs FROM distinct_occupations)
  );
$$;

GRANT EXECUTE ON FUNCTION public.stats_breakdown(text, text, text, text, text) TO anon, authenticated;
