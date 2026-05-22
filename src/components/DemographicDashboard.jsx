import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Users, MapPin, Globe, Briefcase, Search, Printer } from 'lucide-react';
import { printDemographicDashboard } from '../lib/statisticsPrint';
import EmptyState from './EmptyState';
import { SkeletonBar } from './Skeleton';

const toMyanmarNum = (num) => {
  if (num === null || num === undefined) return '';
  const myanmarNumbers = ['၀', '၁', '၂', '၃', '၄', '၅', '၆', '၇', '၈', '၉'];
  return num.toString().split('').map(digit => myanmarNumbers[parseInt(digit)] || digit).join('');
};

// ─── Stat Bar Row (label + bar + count + pct) ──────────────
const StatBar = ({ label, count, total, color, barHeight = 18 }) => {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div style={{ marginBottom: '14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '5px' }}>
        <span style={{ fontSize: '11px', fontWeight: '500', color: '#1A1A1A' }}>{label || '—'}</span>
        <span style={{ fontSize: '11px', color: '#737373', fontFamily: 'var(--font-mono)', letterSpacing: '0.02em' }}>
          {count.toLocaleString()} <span style={{ color: '#B0B0B0' }}>({pct.toFixed(1)}%)</span>
        </span>
      </div>
      <div style={{ height: `${barHeight}px`, backgroundColor: '#F3F4F6', overflow: 'hidden', position: 'relative' }}>
        <div style={{
          height: '100%', backgroundColor: color,
          width: `${Math.max(pct, pct > 0 ? 0.5 : 0)}%`,
          transition: 'width 0.6s ease-out',
        }} />
      </div>
    </div>
  );
};

// ─── Tile Grid (compact category tiles) ────────────────────
const TileGrid = ({ data, color = '#2E7D32' }) => {
  if (!data || data.length === 0) return (
    <div style={{ padding: '16px 0', color: '#9CA3AF', textAlign: 'center', fontSize: '12px' }}>
      အချက်အလက်မရှိပါ
    </div>
  );
  const total = data.reduce((s, d) => s + d.count, 0) || 1;
  const max   = Math.max(...data.map(d => d.count), 1);
  const [rr, gg, bb] = [parseInt(color.slice(1,3),16), parseInt(color.slice(3,5),16), parseInt(color.slice(5,7),16)];

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'stretch' }}>
      {data.map((item) => {
        const pct       = (item.count / total) * 100;
        const intensity = 0.12 + (item.count / max) * 0.8;
        const bg        = `rgba(${rr},${gg},${bb},${(intensity * 0.18).toFixed(2)})`;
        const border    = `rgba(${rr},${gg},${bb},${(intensity * 0.45).toFixed(2)})`;
        const labelClr  = `rgba(${rr},${gg},${bb},${Math.min(intensity + 0.1, 1).toFixed(2)})`;
        const w         = Math.max(pct, 5).toFixed(1);
        return (
          <div key={item.label} style={{
            flexBasis: `calc(${w}% - 6px)`, flexGrow: 0, flexShrink: 0, minWidth: '64px',
            padding: '10px 12px', backgroundColor: bg,
            border: `1px solid ${border}`,
            display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '4px',
            minHeight: '80px',
          }}>
            <span style={{ fontSize: '10px', fontWeight: '600', color: labelClr, lineHeight: 1.3, wordBreak: 'break-word' }}>
              {item.label || '—'}
            </span>
            <span style={{ fontSize: '18px', fontWeight: '700', color: '#1A1A1A', fontFamily: 'var(--font-mono)', lineHeight: 1 }}>
              {item.count.toLocaleString()}
            </span>
            <span style={{ fontSize: '10px', color: '#9CA3AF', lineHeight: 1 }}>{pct.toFixed(1)}%</span>
          </div>
        );
      })}
    </div>
  );
};

// ─── Gender Split Bar ───────────────────────────────────────
const GenderSplit = ({ male, female }) => {
  const total = male + female || 1;
  const mPct  = (male   / total * 100).toFixed(1);
  const fPct  = (female / total * 100).toFixed(1);
  return (
    <div>
      <div style={{ display: 'flex', height: '28px', overflow: 'hidden', marginBottom: '16px', gap: '2px' }}>
        <div style={{ flex: male, backgroundColor: '#4A6572', display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: '4px', transition: 'flex 0.6s ease-out' }}>
          {male > 0 && <span style={{ fontSize: '10px', color: '#fff', fontWeight: '600', whiteSpace: 'nowrap' }}>{mPct}%</span>}
        </div>
        <div style={{ flex: female, backgroundColor: '#A1887F', display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: '4px', transition: 'flex 0.6s ease-out' }}>
          {female > 0 && <span style={{ fontSize: '10px', color: '#fff', fontWeight: '600', whiteSpace: 'nowrap' }}>{fPct}%</span>}
        </div>
      </div>
      <div style={{ display: 'flex', gap: '24px' }}>
        <div style={{ flex: 1, borderLeft: '3px solid #4A6572', paddingLeft: '10px' }}>
          <div style={{ fontSize: '10px', color: '#737373', fontWeight: '600', textTransform: 'uppercase', marginBottom: '4px', letterSpacing: '0.04em' }}>ကျား · Male</div>
          <div style={{ fontSize: '26px', fontWeight: '700', color: '#1A1A1A', fontFamily: 'var(--font-mono)', lineHeight: 1 }}>{male.toLocaleString()}</div>
          <div style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '2px' }}>{mPct}%</div>
        </div>
        <div style={{ flex: 1, borderLeft: '3px solid #A1887F', paddingLeft: '10px' }}>
          <div style={{ fontSize: '10px', color: '#737373', fontWeight: '600', textTransform: 'uppercase', marginBottom: '4px', letterSpacing: '0.04em' }}>မ · Female</div>
          <div style={{ fontSize: '26px', fontWeight: '700', color: '#1A1A1A', fontFamily: 'var(--font-mono)', lineHeight: 1 }}>{female.toLocaleString()}</div>
          <div style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '2px' }}>{fPct}%</div>
        </div>
      </div>
    </div>
  );
};

// ─── ID Card Coverage ───────────────────────────────────────
const IDCardCoverage = ({ withId, total }) => {
  const pct = total > 0 ? (withId / total * 100) : 0;
  const without = Math.max(0, total - withId);
  const r = 40;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '24px', marginBottom: '20px' }}>
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <svg width="96" height="96" viewBox="0 0 96 96">
            <circle cx="48" cy="48" r={r} fill="none" stroke="#F3F4F6" strokeWidth="10" />
            <circle cx="48" cy="48" r={r} fill="none" stroke="#2E7D32" strokeWidth="10"
              strokeDasharray={`${dash} ${circ - dash}`}
              strokeDashoffset={circ / 4}
              strokeLinecap="butt"
              style={{ transition: 'stroke-dasharray 0.8s ease-out' }}
            />
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: '16px', fontWeight: '700', color: '#1A1A1A', lineHeight: 1, fontFamily: 'var(--font-mono)' }}>{pct.toFixed(1)}%</span>
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ marginBottom: '12px', borderLeft: '3px solid #2E7D32', paddingLeft: '10px' }}>
            <div style={{ fontSize: '10px', color: '#737373', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '2px' }}>ID Issued</div>
            <div style={{ fontSize: '22px', fontWeight: '700', color: '#1A1A1A', fontFamily: 'var(--font-mono)', lineHeight: 1 }}>{withId.toLocaleString()}</div>
          </div>
          <div style={{ borderLeft: '3px solid #E5E7EB', paddingLeft: '10px' }}>
            <div style={{ fontSize: '10px', color: '#737373', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '2px' }}>No ID Card</div>
            <div style={{ fontSize: '22px', fontWeight: '700', color: '#9CA3AF', fontFamily: 'var(--font-mono)', lineHeight: 1 }}>{without.toLocaleString()}</div>
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', height: '6px', overflow: 'hidden', backgroundColor: '#F3F4F6' }}>
        <div style={{ flex: withId, backgroundColor: '#2E7D32', transition: 'flex 0.6s ease-out' }} />
        <div style={{ flex: without, backgroundColor: '#E5E7EB' }} />
      </div>
      <div style={{ fontSize: '10px', color: '#9CA3AF', marginTop: '4px', textAlign: 'right' }}>
        Total Population: {total.toLocaleString()}
      </div>
    </div>
  );
};

// ─── Age Pyramid ───────────────────────────────────────────
const AGE_GROUPS = [
  { key: '0_4',   mKey: 'ag0_4m',   fKey: 'ag0_4f',   label: '၀–၄',   labelEn: '0–4',   useCase: 'ကာကွယ်ဆေးထိုးနှင့် အာဟာရ',          color: '#5C8A6B' },
  { key: '5_13',  mKey: 'ag5_13m',  fKey: 'ag5_13f',  label: '၅–၁၃',  labelEn: '5–13',  useCase: 'မူလ/အလယ်တန်း ပညာရေး',              color: '#4A7C8E' },
  { key: '14_17', mKey: 'ag14_17m', fKey: 'ag14_17f', label: '၁၄–၁၇', labelEn: '14–17', useCase: 'အထက်တန်းပညာနှင့် လူငယ်ဖွံ့ဖြိုး',    color: '#6B7FA8' },
  { key: '18_25', mKey: 'ag18_25m', fKey: 'ag18_25f', label: '၁၈–၂၅', labelEn: '18–25', useCase: 'တက္ကသိုလ်နှင့် သက်မွေးဝမ်းကျောင်း',  color: '#8E6B9E' },
  { key: '26_59', mKey: 'ag26_59m', fKey: 'ag26_59f', label: '၂၆–၅၉', labelEn: '26–59', useCase: 'ဒေသတွင်း စီးပွားရေး/အလုပ်အကိုင်',     color: '#2E7D32' },
  { key: '60p',   mKey: 'ag60pm',   fKey: 'ag60pf',   label: '၆၀+',   labelEn: '60+',   useCase: 'ကျန်းမာရေးစောင့်ရှောက်မှု/လူမှုဖေးမ', color: '#8D6E63' },
];

const AgePyramid = ({ stats }) => {
  const total = stats.total || 1;
  const rows = AGE_GROUPS.map(g => ({
    ...g,
    m: stats[g.mKey] || 0,
    f: stats[g.fKey] || 0,
    t: (stats[g.mKey] || 0) + (stats[g.fKey] || 0),
  }));
  const maxSide = Math.max(...rows.map(r => Math.max(r.m, r.f)), 1);

  return (
    <div>
      {/* Legend */}
      <div style={{ display: 'flex', gap: '20px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#737373' }}>
          <div style={{ width: '28px', height: '10px', backgroundColor: '#4A6572' }} />
          ကျား (Male)
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#737373' }}>
          <div style={{ width: '28px', height: '10px', backgroundColor: '#A1887F' }} />
          မ (Female)
        </div>
      </div>

      {/* Pyramid rows — rendered bottom-up visually by reversing */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {[...rows].reverse().map((row) => {
          const mPct  = (row.m / maxSide * 100).toFixed(1);
          const fPct  = (row.f / maxSide * 100).toFixed(1);
          const tPct  = (row.t / total * 100).toFixed(1);
          return (
            <div key={row.key}>
              <div style={{ display: 'flex', alignItems: 'stretch', gap: '0', minHeight: '36px' }}>

                {/* Male bar (grows LEFT) */}
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px', paddingRight: '8px' }}>
                  <span style={{ fontSize: '10px', color: '#737373', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>{row.m.toLocaleString()}</span>
                  <div style={{ width: `${mPct}%`, maxWidth: '100%', height: 'clamp(24px, 2.2vw, 36px)', backgroundColor: '#4A6572', transition: 'width 0.6s ease-out', flexShrink: 0 }} />
                </div>

                {/* Center: age label */}
                <div style={{
                  width: 'clamp(72px, 7vw, 96px)', flexShrink: 0, textAlign: 'center', padding: '0 4px',
                  borderLeft: `3px solid ${row.color}`, borderRight: `3px solid ${row.color}`,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  backgroundColor: `${row.color}12`,
                }}>
                  <span style={{ fontSize: '12px', fontWeight: '700', color: row.color, lineHeight: 1 }}>{row.label}</span>
                  <span style={{ fontSize: '9px', color: '#9CA3AF', lineHeight: 1.2, marginTop: '1px' }}>{row.labelEn}</span>
                </div>

                {/* Female bar (grows RIGHT) */}
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '6px', paddingLeft: '8px' }}>
                  <div style={{ width: `${fPct}%`, maxWidth: '100%', height: 'clamp(24px, 2.2vw, 36px)', backgroundColor: '#A1887F', transition: 'width 0.6s ease-out', flexShrink: 0 }} />
                  <span style={{ fontSize: '10px', color: '#737373', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>{row.f.toLocaleString()}</span>
                </div>
              </div>

              {/* Use-case annotation + total */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px', paddingLeft: 'calc(50% - 36px)', paddingBottom: '4px', borderBottom: '1px dashed #F3F4F6' }}>
                <span style={{ fontSize: '9px', color: '#9CA3AF' }}>ပေါင်း {row.t.toLocaleString()} ({tPct}%)</span>
                <span style={{ fontSize: '9px', color: row.color, fontStyle: 'italic' }}>· {row.useCase}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* X-axis scale hint */}
      <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'center', gap: '4px', fontSize: '9px', color: '#C0C0C0' }}>
        <span>← ကျား</span>
        <span style={{ flex: 1, textAlign: 'center', borderTop: '1px solid #E5E7EB', marginTop: '6px' }} />
        <span>မ →</span>
      </div>
    </div>
  );
};

// ─── Cache ─────────────────────────────────────────────────
const CACHE_KEY = 'tps_demo_cache_v1';
const CACHE_TTL_MS = 5 * 60 * 1000;

const readCache = (key) => {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const { timestamp, data } = JSON.parse(raw);
    if (Date.now() - timestamp > CACHE_TTL_MS) return null;
    return data;
  } catch { return null; }
};
const writeCache = (key, data) => {
  try { sessionStorage.setItem(key, JSON.stringify({ timestamp: Date.now(), data })); } catch {}
};

// ─── Colors ────────────────────────────────────────────────
const colors = {
  forestGreen: '#2E7D32',
  earthyBrown: '#8D6E63',
  slateGray:   '#4A6572',
  tealDusk:    '#00695C',
  black:       '#1A1A1A',
};

const sectionCardStyle = {
  backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB',
  padding: '24px', marginBottom: '0',
};
const sectionTitleStyle = {
  fontSize: '12px', fontWeight: '600', color: '#1A1A1A',
  marginBottom: '20px', paddingBottom: '10px', borderBottom: '1px solid #E5E7EB',
  display: 'flex', alignItems: 'center', gap: '8px',
  textTransform: 'uppercase', letterSpacing: '0.05em',
};

// ─── Main Component ────────────────────────────────────────
const DemographicDashboard = () => {
  const [statsData, setStatsData] = useState(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);

  const [districts, setDistricts]               = useState([]);
  const [townships, setTownships]               = useState([]);
  const [wards, setWards]                       = useState([]);
  const [groups, setGroups]                     = useState([]);
  const [filteredVillages, setFilteredVillages] = useState([]);

  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [selectedTownship, setSelectedTownship] = useState('');
  const [selectedWard, setSelectedWard]         = useState('');
  const [selectedGroup, setSelectedGroup]       = useState('');
  const [selectedVillage, setSelectedVillage]   = useState('');

  // ─── Load districts ───────────────────────────────────────
  const loadDistricts = async () => {
    try {
      const { data, error } = await supabase.rpc('stats_districts');
      if (error) throw error;
      setDistricts(data?.map(d => d.name) || []);
    } catch (err) { console.error(err); }
  };

  // ─── Load townships ───────────────────────────────────────
  const loadTownships = async (district) => {
    if (!district) { setTownships([]); return; }
    try {
      const { data, error } = await supabase.rpc('stats_townships', { p_district: district });
      if (error) throw error;
      setTownships(data?.map(t => t.name) || []);
    } catch { setTownships([]); }
  };

  // ─── Load ward/group/village ──────────────────────────────
  const loadLocations = async (district, township) => {
    if (!district || !township) {
      setWards([]); setGroups([]); setFilteredVillages([]);
      return;
    }
    try {
      const { data, error } = await supabase.rpc('stats_locations', {
        p_district: district, p_township: township,
      });
      if (error) throw error;
      const locations = data || [];
      setWards(locations.filter(l => l.kind === 'ward').map(l => l.name));
      setGroups(locations.filter(l => l.kind === 'group').map(l => l.name));
    } catch { setWards([]); setGroups([]); }
  };

  // ─── Load villages for a selected group ──────────────────
  const loadVillagesForGroup = async (district, township, group) => {
    if (!district || !township || !group) { setFilteredVillages([]); return; }
    try {
      const { data, error } = await supabase
        .from('households')
        .select('ward_village_group')
        .eq('district', district)
        .eq('township', township)
        .ilike('ward_village_group', `%${group}%`);
      if (error) throw error;
      const villageSet = new Set();
      (data || []).forEach(row => {
        (row.ward_village_group || '').split(/[,၊]/).map(p => p.trim()).filter(Boolean).forEach(p => {
          if (p.includes('ရွာ') && !p.includes('အုပ်စု') && !p.includes('ရပ်ကွက်')) villageSet.add(p);
        });
      });
      setFilteredVillages([...villageSet].sort());
    } catch { setFilteredVillages([]); }
  };

  // ─── Main stats fetch ─────────────────────────────────────
  const loadStats = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    setError(null);
    const cacheKey = `${CACHE_KEY}_${selectedDistrict||'all'}_${selectedTownship||'all'}_${selectedWard||'all'}_${selectedGroup||'all'}_${selectedVillage||'all'}`;
    if (!forceRefresh) {
      const cached = readCache(cacheKey);
      if (cached) { setStatsData(cached); setLoading(false); return; }
    }
    try {
      const { data, error: rpcErr } = await supabase.rpc('stats_breakdown', {
        p_district: selectedDistrict || null,
        p_township: selectedTownship || null,
        p_ward:     selectedWard     || null,
        p_village:  selectedVillage  || null,
        p_group:    selectedGroup    || null,
      });
      if (rpcErr) throw rpcErr;
      setStatsData(data);
      writeCache(cacheKey, data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [selectedDistrict, selectedTownship, selectedWard, selectedGroup, selectedVillage]);

  // Initial load
  useEffect(() => { loadDistricts(); loadStats(); }, []);
  useEffect(() => { loadStats(); }, [loadStats]);

  // District change → reset everything below
  useEffect(() => {
    loadTownships(selectedDistrict);
    setSelectedTownship('');
    setSelectedWard('');
    setSelectedGroup('');
    setSelectedVillage('');
  }, [selectedDistrict]);

  // Township change → load wards/groups, reset below
  useEffect(() => {
    loadLocations(selectedDistrict, selectedTownship);
    setSelectedWard('');
    setSelectedGroup('');
    setSelectedVillage('');
  }, [selectedTownship]);

  // Group change → load villages for that group, reset village
  useEffect(() => {
    setSelectedVillage('');
    if (selectedGroup) loadVillagesForGroup(selectedDistrict, selectedTownship, selectedGroup);
    else setFilteredVillages([]);
  }, [selectedGroup]);

  // Ward selected → clear group/village
  useEffect(() => {
    if (selectedWard) { setSelectedGroup(''); setSelectedVillage(''); setFilteredVillages([]); }
  }, [selectedWard]);

  // ─── Derived data ─────────────────────────────────────────
  const totalStats      = statsData?.totalStats || {};
  const allReligions    = statsData?.allReligions || [];
  const allNationalities = statsData?.allNationalities || [];
  const allOccupations  = statsData?.allOccupations || [];

  const totalPopulation = totalStats.total  || 0;
  const totalMale       = totalStats.male   || 0;
  const totalFemale     = totalStats.female || 0;
  const religiousData = allReligions.map(r => ({
    label: r, count: totalStats.relCounts?.[r] || 0,
  })).sort((a, b) => b.count - a.count);

  const nationalityData = allNationalities.map(n => ({
    label: n, count: totalStats.natCounts?.[n] || 0,
  })).sort((a, b) => b.count - a.count);

  const occupationData = allOccupations.map(o => ({
    label: o, count: totalStats.occCounts?.[o] || 0,
  })).sort((a, b) => b.count - a.count);

  const selectStyle = {
    width: '100%', padding: '6px 28px 6px 10px', borderRadius: '0px',
    border: '1px solid #E5E7EB', fontSize: '11px', fontFamily: 'Inter, sans-serif',
    backgroundColor: '#FFFFFF', boxSizing: 'border-box', marginTop: '4px',
    color: '#1A1A1A', height: '32px', lineHeight: '1.4',
    appearance: 'none', WebkitAppearance: 'none', MozAppearance: 'none',
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%23737373'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center',
    cursor: 'pointer',
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1440px', margin: '0 auto' }} className="xl:px-10 2xl:px-16">

      {/* ─── Header ─────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6 sm:mb-8">
        <div>
          <h2 style={{ fontSize: '18px', margin: '0 0 4px 0', color: colors.black, fontWeight: '600', letterSpacing: '0.02em' }}>
            DEMOGRAPHIC DASHBOARD
          </h2>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <button
            onClick={() => {
              if (!statsData) return;
              printDemographicDashboard({
                totalStats, allReligions, allNationalities, allOccupations,
                selectedDistrict, selectedTownship, selectedWard, selectedGroup, selectedVillage,
              });
            }}
            disabled={!statsData || loading}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5"
            style={{ fontSize: '11px', border: '1px solid #1A1A1A', background: '#1A1A1A', color: '#fff', padding: '6px 14px', cursor: !statsData || loading ? 'not-allowed' : 'pointer', textTransform: 'uppercase', letterSpacing: '0.05em', flexShrink: 0, opacity: !statsData || loading ? 0.45 : 1 }}
          >
            <Printer size={12} /> Print
          </button>
          <button
            onClick={() => { try { sessionStorage.removeItem(CACHE_KEY); } catch {} loadDistricts(); loadStats(true); }}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5"
            style={{ fontSize: '11px', border: '1px solid #E5E7EB', background: 'none', color: '#737373', padding: '6px 14px', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.05em', flexShrink: 0 }}
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* ─── Filter Section ──────────────────────────────── */}
      <div style={{ ...sectionCardStyle, marginBottom: '24px' }}>
        <div style={sectionTitleStyle}>
          <Search size={14} color={colors.black} /> FILTER BY LOCATION
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 xl:gap-5">

          {/* District */}
          <div>
            <label style={{ fontSize: '11px', fontWeight: '500', color: '#737373', display: 'block', letterSpacing: '0.02em' }}>
              ခရိုင် (DISTRICT)
            </label>
            <select value={selectedDistrict} onChange={e => setSelectedDistrict(e.target.value)} style={selectStyle}>
              <option value="">--- အားလုံး (All Districts) ---</option>
              {districts.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          {/* Township */}
          <div>
            <label style={{ fontSize: '11px', fontWeight: '500', color: '#737373', display: 'block', letterSpacing: '0.02em' }}>
              မြို့နယ် (TOWNSHIP)
            </label>
            <select value={selectedTownship} onChange={e => setSelectedTownship(e.target.value)} style={selectStyle} disabled={!selectedDistrict}>
              <option value="">--- အားလုံး (All Townships) ---</option>
              {townships.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          {/* Ward */}
          <div>
            <label style={{ fontSize: '11px', fontWeight: '500', color: '#737373', display: 'block', letterSpacing: '0.02em' }}>
              ရပ်ကွက် (WARD)
            </label>
            <select value={selectedWard} onChange={e => setSelectedWard(e.target.value)} style={selectStyle} disabled={!selectedTownship}>
              <option value="">--- အားလုံး (All Wards) ---</option>
              {wards.map(w => <option key={w} value={w}>{w}</option>)}
            </select>
          </div>

          {/* Group */}
          <div>
            <label style={{ fontSize: '11px', fontWeight: '500', color: '#737373', display: 'block', letterSpacing: '0.02em' }}>
              အုပ်စု (GROUP)
            </label>
            <select value={selectedGroup} onChange={e => setSelectedGroup(e.target.value)} style={selectStyle} disabled={!selectedTownship || !!selectedWard}>
              <option value="">--- အားလုံး (All Groups) ---</option>
              {groups.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>

          {/* Village */}
          <div>
            <label style={{ fontSize: '11px', fontWeight: '500', color: '#737373', display: 'block', letterSpacing: '0.02em' }}>
              ကျေးရွာ (VILLAGE)
            </label>
            <select value={selectedVillage} onChange={e => setSelectedVillage(e.target.value)} style={selectStyle} disabled={!selectedGroup}>
              <option value="">--- အားလုံး (All Villages) ---</option>
              {filteredVillages.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>

        </div>

        {/* Active filter breadcrumb */}
        {selectedDistrict && (
          <div style={{ marginTop: '16px', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', color: '#737373', textTransform: 'uppercase' }}>Active Filters:</span>
            <span style={{ fontSize: '11px', border: `1px solid ${colors.forestGreen}`, padding: '2px 8px', color: colors.forestGreen, fontWeight: '500' }}>{selectedDistrict}</span>
            {selectedTownship && (
              <span style={{ fontSize: '11px', border: `1px solid ${colors.forestGreen}`, padding: '2px 8px', color: colors.forestGreen, fontWeight: '500' }}>{selectedTownship}</span>
            )}
            {selectedWard && (
              <span style={{ fontSize: '11px', border: `1px solid ${colors.forestGreen}`, padding: '2px 8px', color: colors.forestGreen, fontWeight: '500' }}>{selectedWard}</span>
            )}
            {selectedGroup && (
              <span style={{ fontSize: '11px', border: `1px solid ${colors.forestGreen}`, padding: '2px 8px', color: colors.forestGreen, fontWeight: '500' }}>{selectedGroup}</span>
            )}
            {selectedVillage && (
              <span style={{ fontSize: '11px', border: `1px solid ${colors.forestGreen}`, padding: '2px 8px', color: colors.forestGreen, fontWeight: '500' }}>{selectedVillage}</span>
            )}
            <button
              onClick={() => { setSelectedDistrict(''); setSelectedTownship(''); setSelectedWard(''); setSelectedGroup(''); setSelectedVillage(''); }}
              style={{ fontSize: '11px', border: `1px solid ${colors.black}`, background: 'none', color: colors.black, padding: '2px 8px', cursor: 'pointer', textTransform: 'uppercase' }}
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {/* ─── Error ───────────────────────────────────────── */}
      {error && !loading && (
        <div style={{ border: '1px solid #E5E7EB', marginBottom: '24px' }}>
          <EmptyState
            type={!navigator.onLine ? 'offline' : 'error'}
            message="Could not load demographic data."
            detail={error}
            action={{ label: 'Retry', onClick: () => loadStats(true) }}
          />
        </div>
      )}

      {/* ─── Loading skeleton ────────────────────────────── */}
      {loading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
          {[1,2,3,4,5].map(i => (
            <div key={i} style={{ ...sectionCardStyle, minHeight: '140px' }}>
              <SkeletonBar />
            </div>
          ))}
        </div>
      )}

      {/* ─── Charts ──────────────────────────────────────── */}
      {!loading && !error && statsData && (
        <>
          {/* ── Summary Strip ──────────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 xl:gap-4 mb-4">
            {[
              { label: 'Total Population', value: totalPopulation, accent: colors.forestGreen },
              { label: 'Male · ကျား',       value: totalMale,      accent: colors.slateGray   },
              { label: 'Female · မ',        value: totalFemale,    accent: '#A1887F'           },
            ].map(({ label, value, accent }) => (
              <div key={label} style={{ backgroundColor: '#fff', border: '1px solid #E5E7EB', padding: '16px 20px', borderTop: `3px solid ${accent}` }} className="xl:py-5 xl:px-6">
                <div style={{ fontSize: '10px', color: '#737373', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>{label}</div>
                <div style={{ fontSize: '28px', fontWeight: '700', color: '#1A1A1A', fontFamily: 'var(--font-mono)', lineHeight: 1 }}>{value.toLocaleString()}</div>
              </div>
            ))}
          </div>

          {/* ── Row 1: Religion + Nationality ─────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 xl:gap-5 mb-4">

            {/* Religious Statistics */}
            <div style={sectionCardStyle}>
              <div style={sectionTitleStyle}>
                <MapPin size={13} color={colors.black} /> RELIGIOUS STATISTICS
              </div>
              {religiousData.length === 0
                ? <div style={{ color: '#9CA3AF', fontSize: '12px', padding: '8px 0' }}>အချက်အလက်မရှိပါ</div>
                : religiousData.map(item => (
                    <StatBar key={item.label} label={item.label}
                      count={item.count} total={totalPopulation}
                      color={colors.earthyBrown} barHeight={16} />
                  ))
              }
            </div>

            {/* Nationality Statistics */}
            <div style={sectionCardStyle}>
              <div style={sectionTitleStyle}>
                <Globe size={13} color={colors.black} /> NATIONALITY STATISTICS
              </div>
              <TileGrid data={nationalityData} color={colors.forestGreen} />
            </div>

          </div>

          {/* ── Age Pyramid ────────────────────────────────── */}
          <div style={{ ...sectionCardStyle, marginBottom: '16px' }}>
            <div style={sectionTitleStyle}>
              <Users size={13} color={colors.black} /> လူမှုဘဝကဏ္ဍအလိုက် ခွဲခြားခြင်း (FUNCTIONAL AGE GROUPS)
            </div>
            <AgePyramid stats={totalStats} />
          </div>

          {/* ── Occupation (full width) ───────────────────── */}
          <div style={sectionCardStyle}>
            <div style={sectionTitleStyle}>
              <Briefcase size={13} color={colors.black} /> OCCUPATION STATISTICS
            </div>
            <TileGrid data={occupationData} color={colors.tealDusk} />
          </div>
        </>
      )}

    </div>
  );
};

export default DemographicDashboard;
