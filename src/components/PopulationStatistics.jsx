import React, { useState, useEffect, useCallback } from 'react';
import { SkeletonStatGrid, SkeletonBar } from './Skeleton';
import { supabase } from '../lib/supabase';
import { Users, User, Home, Search, BarChart2, Printer, FileSpreadsheet, Send, CheckCircle2, ChevronDown, Loader2 } from 'lucide-react';
import EmptyState from './EmptyState';
import { printStatistics, exportStatisticsExcel } from '../lib/statisticsPrint';

const toMyanmarNum = (num) => {
  if (num === null || num === undefined || num === '') return '0';
  const n = typeof num === 'number' ? num : Number(num);
  return isNaN(n) ? num.toString() : n.toLocaleString('en-US');
};

// Normalize mixed nationalities for display (e.g., 'ဗမာ+ရှမ်း' → 'ဗမာ')
// Database keeps original, UI shows only first nationality
const normalizeNationalityDisplay = (nationality) => {
  if (!nationality || typeof nationality !== 'string') return nationality;
  // Split by + or / and take the first part, then trim
  const firstPart = nationality.split(/[+/]/)[0];
  return firstPart ? firstPart.trim() : nationality;
};

const parseMyanmarDate = (dateStr) => {
  if (!dateStr) return null;
  const myanmarToArabic = { '၀': '0', '၁': '1', '၂': '2', '၃': '3', '၄': '4', '၅': '5', '၆': '6', '၇': '7', '၈': '8', '၉': '9' };
  const arabicStr = dateStr.split('').map(ch => myanmarToArabic[ch] || ch).join('');
  const parts = arabicStr.split('.');
  if (parts.length === 3) {
    const day = parseInt(parts[0]);
    const month = parseInt(parts[1]);
    const year = parseInt(parts[2]);
    if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
      return new Date(year, month - 1, day);
    }
  }
  const dashParts = arabicStr.split('-');
  if (dashParts.length === 3) {
    const day = parseInt(dashParts[0]);
    const year = parseInt(dashParts[2]);
    if (!isNaN(day) && !isNaN(year)) {
      return new Date(year, 0, day);
    }
  }
  return null;
};

const calculateAge = (dateStr) => {
  const dob = parseMyanmarDate(dateStr);
  if (!dob) return null;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  return age;
};

// ─── Classify Ward/Village/Group ────────────────────────────
// Returns: 'ward' | 'village' | 'group' | 'unknown'
const classifyWardVillageGroup = (value) => {
  if (!value || typeof value !== 'string') return 'unknown';
  const str = value.trim();
  if (str === '') return 'unknown';
  
  // Check for Ward (ရပ်ကွက်)
  if (str.includes('ရပ်ကွက်')) {
    return 'ward';
  }
  
  // Check for Group (အုပ်စု) - MUST check BEFORE Village
  // because group names might contain "ရွာ" (e.g., "ကျေးရွာအုပ်စု")
  if (str.includes('အုပ်စု')) {
    return 'group';
  }
  
  // Check for Village (ရွာ)
  if (str.includes('ရွာ')) {
    return 'village';
  }
  
  return 'unknown';
};

const splitWardVillageGroupParts = (value) => {
  if (!value || typeof value !== 'string') return [];
  return value
    .split(/[,၊]/)
    .map(part => part.trim())
    .filter(Boolean);
};

const getWardVillageGroupEntries = (value) => (
  splitWardVillageGroupParts(value)
    .map(name => ({ name, type: classifyWardVillageGroup(name) }))
    .filter(entry => entry.type !== 'unknown')
);

const recordMatchesLocation = (record, selectedName, expectedType) => {
  if (!selectedName) return true;
  return getWardVillageGroupEntries(record?.ward_village_group).some(
    entry => entry.name === selectedName && (!expectedType || entry.type === expectedType)
  );
};

// ─── Stat Card ────────────────────────────────────────────
const StatCard = ({ label, value, icon: Icon, color = '#1A1A1A' }) => (
  <div style={{
    backgroundColor: '#FFFFFF',
    border: '1px solid #E5E7EB',
    padding: '24px',
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    borderRadius: '0px',
  }}
  >
    <div style={{
      width: '40px', height: '40px',
      border: `1px solid ${color}`,
      color: color,
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      borderRadius: '0px',
    }}>
      {Icon && <Icon size={16} strokeWidth={1.5} />}
    </div>
    <div>
      <div style={{ fontSize: '10px', color: '#737373', fontWeight: '600', marginBottom: '4px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: '24px', fontWeight: '500', color: '#1A1A1A', lineHeight: 1.2, fontFamily: 'var(--font-mono)' }}>{toMyanmarNum(value)}</div>
    </div>
  </div>
);

// ─── Cache helpers ────────────────────────────────────────
const CACHE_KEY = 'tps_stats_cache_v2_rpc';
const CACHE_VERSION = 'v2';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

const readCache = () => {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { version, timestamp, data } = JSON.parse(raw);
    if (version !== CACHE_VERSION) return null;
    if (Date.now() - timestamp > CACHE_TTL_MS) return null;
    return data;
  } catch {
    return null;
  }
};

const writeCache = (data) => {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({
      version: CACHE_VERSION,
      timestamp: Date.now(),
      data
    }));
  } catch {
    // sessionStorage full or unavailable — ignore silently
  }
};

const clearCache = () => {
  try { sessionStorage.removeItem(CACHE_KEY); } catch {}
};

// ─── Custom Responsive Dropdown Selector ─────────────────────
const CustomLocationSelect = ({ value, onChange, options, placeholder, disabled, isMobile }) => {
  const [open, setOpen] = useState(false);
  const ref = React.useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [open]);

  const selectedLabel = value || placeholder;

  return (
    <div ref={ref} style={{ position: 'relative', width: '100%' }}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(v => !v)}
        style={{
          width: '100%',
          padding: '6px 24px 6px 10px',
          borderRadius: '0px',
          border: '1px solid #E5E7EB',
          fontSize: '11px',
          fontFamily: "Inter, 'Pyidaungsu', sans-serif",
          backgroundColor: disabled ? '#FAFAFA' : '#FFFFFF',
          boxSizing: 'border-box',
          marginTop: '4px',
          color: disabled ? '#9CA3AF' : '#1A1A1A',
          height: '32px',
          lineHeight: '1.4',
          textAlign: 'left',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.65 : 1,
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selectedLabel}
        </span>
        <ChevronDown size={12} color="#737373" style={{ flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 150ms' }} />
      </button>

      {open && !disabled && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 2px)',
          left: 0, right: 0,
          backgroundColor: '#FFFFFF',
          border: '1px solid #1A1A1A',
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          maxHeight: '220px',
          overflowY: 'auto',
          zIndex: 999,
          borderRadius: '0px',
        }}>
          <div
            onClick={() => { onChange(''); setOpen(false); }}
            style={{
              padding: '8px 12px',
              fontSize: '11px',
              color: !value ? '#FFFFFF' : '#1A1A1A',
              backgroundColor: !value ? '#1A1A1A' : '#FFFFFF',
              fontWeight: !value ? '600' : '400',
              cursor: 'pointer',
              borderBottom: '1px solid #F3F4F6',
            }}
          >
            {placeholder}
          </div>
          {options.map(opt => {
            const isSelected = value === opt;
            return (
              <div
                key={opt}
                onClick={() => { onChange(opt); setOpen(false); }}
                style={{
                  padding: '8px 12px',
                  fontSize: '11px',
                  color: isSelected ? '#FFFFFF' : '#1A1A1A',
                  backgroundColor: isSelected ? '#1A1A1A' : '#FFFFFF',
                  fontWeight: isSelected ? '600' : '400',
                  cursor: 'pointer',
                  borderBottom: '1px solid #F9FAFB',
                }}
              >
                {opt}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────
const PopulationStatistics = ({ user }) => {
  const districtFilter = (user?.access_level !== 'central' && user?.allowed_districts?.length > 0)
    ? user.allowed_districts : null;
  const townshipFilter = ((user?.access_level === 'township' || user?.access_level === 'sub_township') && user?.allowed_townships?.length > 0)
    ? user.allowed_townships : null;
  const isViewer = user?.access_level === 'viewer' || user?.access_level === 'sub_township';
  // RPC response data (replaces allData)
  const [statsData, setStatsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Location lists from RPCs
  const [districts, setDistricts] = useState([]);
  const [townships, setTownships] = useState([]);
  const [wards, setWards] = useState([]);
  const [villages, setVillages] = useState([]);
  const [groups, setGroups] = useState([]);
  const [filteredVillages, setFilteredVillages] = useState([]);
  const [townshipLocations, setTownshipLocations] = useState([]);

  // Selected filters
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [selectedTownship, setSelectedTownship] = useState('');
  const [selectedWard, setSelectedWard] = useState('');
  const [selectedVillage, setSelectedVillage] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('');

  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 640);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const PAGE_SIZE = 25;
  const [page1, setPage1] = useState(1);
  const [page2, setPage2] = useState(1);

  // Separate pagination for Ward/Village/Group tables
  const [wardPage1, setWardPage1] = useState(1);
  const [wardPage2, setWardPage2] = useState(1);
  const [villagePage1, setVillagePage1] = useState(1);
  const [villagePage2, setVillagePage2] = useState(1);
  const [groupPage1, setGroupPage1] = useState(1);
  const [groupPage2, setGroupPage2] = useState(1);
  const [reqSending,    setReqSending]    = useState(false);
  const [reqSent,       setReqSent]       = useState(null); // 'print' | 'excel' | null
  const [approvedTypes, setApprovedTypes] = useState(new Set());

  // Load already-approved requests + subscribe to live approval changes
  useEffect(() => {
    if (!isViewer || !user?.id) return;
    supabase
      .from('print_export_requests')
      .select('export_type')
      .eq('requester_id', user.id)
      .eq('page', 'statistics')
      .eq('status', 'resolved')
      .then(({ data }) => {
        if (data?.length) setApprovedTypes(new Set(data.map(r => r.export_type)));
      });
    const ch = supabase
      .channel(`stats-req-${user.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'print_export_requests',
        filter: `requester_id=eq.${user.id}` }, (payload) => {
        if (payload.new.page === 'statistics' && payload.new.status === 'resolved') {
          setApprovedTypes(prev => new Set([...prev, payload.new.export_type]));
        }
      })
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [isViewer, user?.id]);

  const markUsed = async (exportType) => {
    await supabase
      .from('print_export_requests')
      .update({ status: 'used' })
      .eq('requester_id', user.id)
      .eq('page', 'statistics')
      .eq('export_type', exportType)
      .eq('status', 'resolved');
    setApprovedTypes(prev => { const n = new Set(prev); n.delete(exportType); return n; });
  };

  // ─── Fetch districts via RPC ──────────────────────────────
  const submitRequest = async (exportType) => {
    setReqSending(true);
    try {
      const { error } = await supabase.from('print_export_requests').insert({
        requester_id:   user.id,
        requester_name: user.profile?.display_name || user.profile?.username || user.email || 'Unknown',
        page:           'statistics',
        export_type:    exportType,
        filters: {
          district: selectedDistrict  || null,
          township: selectedTownship  || null,
          ward:     selectedWard      || null,
          group:    selectedGroup     || null,
          village:  selectedVillage   || null,
          _level:   user?.access_level || 'viewer',
        },
      });
      if (error) throw error;
      setReqSent(exportType);
      setTimeout(() => setReqSent(null), 6000);
    } catch (err) {
      alert('Failed to send request: ' + err.message);
    } finally {
      setReqSending(false);
    }
  };

  const loadDistricts = async () => {
    try {
      const { data, error } = await supabase.rpc('stats_districts');
      if (error) throw error;
      let list = data?.map(d => d.name) || [];
      if (districtFilter) list = list.filter(d => districtFilter.includes(d));
      setDistricts(list);
      if (list.length === 1) setSelectedDistrict(list[0]);
    } catch (err) {
      console.error('Failed to load districts:', err);
      setError(err.message);
    }
  };

  // ─── Fetch townships via RPC ──────────────────────────────
  const loadTownships = async (district) => {
    if (!district) {
      setTownships([]);
      return;
    }
    try {
      const { data, error } = await supabase.rpc('stats_townships', { p_district: district });
      if (error) throw error;
      let list = data?.map(t => t.name) || [];
      if (townshipFilter) list = list.filter(t => townshipFilter.includes(t));
      setTownships(list);
      if (list.length === 1) setSelectedTownship(list[0]);
    } catch (err) {
      console.error('Failed to load townships:', err);
      setTownships([]);
    }
  };

  // ─── Fetch ward/village/group via RPC ─────────────────────
  const loadLocations = async (district, township) => {
    if (!district || !township) {
      setWards([]);
      setVillages([]);
      setGroups([]);
      setFilteredVillages([]);
      return;
    }
    try {
      const { data, error } = await supabase.rpc('stats_locations', {
        p_district: district,
        p_township: township
      });
      if (error) throw error;
      const locations = data || [];
      setWards(locations.filter(l => l.kind === 'ward').map(l => l.name));
      setVillages(locations.filter(l => l.kind === 'village').map(l => l.name));
      setGroups(locations.filter(l => l.kind === 'group').map(l => l.name));
      setFilteredVillages([]);
    } catch (err) {
      console.error('Failed to load locations:', err);
      setWards([]);
      setVillages([]);
      setGroups([]);
      setFilteredVillages([]);
    }
  };

  // ─── Fetch villages that belong to a specific group ────────
  const loadVillagesForGroup = async (district, township, group) => {
    if (!district || !township || !group) {
      setFilteredVillages([]);
      return;
    }
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
        const parts = (row.ward_village_group || '').split(/[,၊]/).map(p => p.trim()).filter(Boolean);
        parts.forEach(p => {
          if (p.includes('ရွာ') && !p.includes('အုပ်စု') && !p.includes('ရပ်ကွက်')) {
            villageSet.add(p);
          }
        });
      });
      setFilteredVillages([...villageSet].sort());
    } catch (err) {
      console.error('Failed to load villages for group:', err);
      setFilteredVillages([]);
    }
  };

  // ─── Main stats fetch via RPC ───────────────────────────
  const loadStats = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    setError(null);

    // Build cache key from current filters
    const cacheKey = `${selectedDistrict || 'all'}_${selectedTownship || 'all'}_${selectedWard || 'all'}_${selectedVillage || 'all'}_${selectedGroup || 'all'}`;

    // Try cache first (skip if force refresh)
    if (!forceRefresh) {
      const cached = readCache();
      if (cached && cached.key === cacheKey) {
        setStatsData(cached.data);
        setLoading(false);
        return;
      }
    }

    try {
      const { data, error } = await supabase.rpc('stats_breakdown', {
        p_district: selectedDistrict || null,
        p_township: selectedTownship || null,
        p_ward: selectedWard || null,
        p_village: selectedVillage || null,
        p_group: selectedGroup || null
      });
      if (error) throw error;

      setStatsData(data);
      writeCache({ key: cacheKey, data });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [selectedDistrict, selectedTownship, selectedWard, selectedVillage, selectedGroup]);

  // Initial load: districts and stats
  useEffect(() => {
    loadDistricts();
    loadStats();
  }, []);

  // Reload stats when filters change
  useEffect(() => {
    loadStats();
  }, [loadStats]);

  // Cache township sub-location stats when full township is loaded
  useEffect(() => {
    if (statsData?.groupKey === 'wvg' && !selectedGroup && !selectedWard) {
      setTownshipLocations(statsData.groupStats || []);
    }
  }, [statsData, selectedGroup, selectedWard]);

  // Load townships when district changes
  useEffect(() => {
    loadTownships(selectedDistrict);
    setSelectedTownship('');
    setSelectedWard('');
    setSelectedVillage('');
    setSelectedGroup('');
    setPage1(1);
    setPage2(1);
    setWardPage1(1); setWardPage2(1);
    setVillagePage1(1); setVillagePage2(1);
    setGroupPage1(1); setGroupPage2(1);
  }, [selectedDistrict]);

  // Load locations when township changes
  useEffect(() => {
    loadLocations(selectedDistrict, selectedTownship);
    setSelectedWard('');
    setSelectedVillage('');
    setSelectedGroup('');
    setPage1(1);
    setPage2(1);
    setWardPage1(1); setWardPage2(1);
    setVillagePage1(1); setVillagePage2(1);
    setGroupPage1(1); setGroupPage2(1);
    setTownshipLocations([]);
  }, [selectedTownship]);

  // Reset village and load filtered villages when group changes
  useEffect(() => {
    setSelectedVillage('');
    setVillagePage1(1); setVillagePage2(1);
    if (selectedGroup) {
      loadVillagesForGroup(selectedDistrict, selectedTownship, selectedGroup);
    } else {
      setFilteredVillages([]);
    }
  }, [selectedGroup]);

  // Reset group and village when ward is selected
  useEffect(() => {
    if (selectedWard) {
      setSelectedGroup('');
      setSelectedVillage('');
      setFilteredVillages([]);
    }
  }, [selectedWard]);

  // ─── Derived stats from RPC response ─────────────────────
  const totalStats = statsData?.totalStats || {};
  const groupStats = statsData?.groupStats || [];
  const allReligions = statsData?.allReligions || [];
  const allNationalities = statsData?.allNationalities || [];
  const totalPopulation = totalStats.total || 0;
  const totalMale = totalStats.male || 0;
  const totalFemale = totalStats.female || 0;

  const under16 = (totalStats.u16m || 0) + (totalStats.u16f || 0);
  const between16and60 = (totalStats.b1660m || 0) + (totalStats.b1660f || 0);
  const above60 = (totalStats.a60m || 0) + (totalStats.a60f || 0);
  const unknownAge = totalStats.unknownAge || 0;

  // Religious data for bar chart
  const religiousData = allReligions.map(r => ({
    label: r,
    count: totalStats.relCounts?.[r] || 0
  })).sort((a, b) => b.count - a.count);

  // Aggregate nationality counts by normalized name
  // e.g., "ဗမာ" (50) + "ဗမာ+ရှမ်း" (30) + "ရှမ်း+ဗမာ" (20) → "ဗမာ": 100
  const aggregatedNatCounts = allNationalities.reduce((acc, n) => {
    const normalized = normalizeNationalityDisplay(n);
    const count = totalStats.natCounts?.[n] || 0;
    acc[normalized] = (acc[normalized] || 0) + count;
    return acc;
  }, {});
  const nationalityData = Object.entries(aggregatedNatCounts)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);

  // Unique normalized nationalities for table headers (sorted by count desc)
  const uniqueNormalizedNats = nationalityData.map(n => n.label);

  // Helper: Get aggregated nationality count for a row (ward/group/village)
  // Aggregates counts from all nationalities that normalize to the same name
  const getAggregatedNatCount = (natCounts, normalizedNat) => {
    if (!natCounts) return 0;
    return allNationalities.reduce((sum, n) => {
      if (normalizeNationalityDisplay(n) === normalizedNat) {
        return sum + (natCounts[n] || 0);
      }
      return sum;
    }, 0);
  };

  const selectStyle = {
    width: '100%', padding: '6px 28px 6px 10px', borderRadius: '0px',
    border: '1px solid #E5E7EB', fontSize: '11px', fontFamily: "Inter, 'Pyidaungsu', sans-serif",
    backgroundColor: '#FFFFFF', boxSizing: 'border-box', marginTop: '4px',
    color: '#1A1A1A', height: '32px', lineHeight: '1.4',
    appearance: 'none', WebkitAppearance: 'none', MozAppearance: 'none',
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%23737373'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center',
    cursor: 'pointer',
  };

  const sectionCardStyle = {
    backgroundColor: '#FFFFFF', borderRadius: '0px', border: '1px solid #E5E7EB',
    padding: '24px', marginBottom: '24px',
  };
  const sectionCardClass = 'tps-section-card';

  const sectionTitleStyle = {
    fontSize: '12px', fontWeight: '600', color: '#1A1A1A',
    marginBottom: '20px', paddingBottom: '10px', borderBottom: '1px solid #E5E7EB',
    display: 'flex', alignItems: 'center', gap: '8px',
    textTransform: 'uppercase', letterSpacing: '0.05em'
  };

  if (loading && !statsData) {
    return (
      <div style={{ padding: '32px' }} className="max-w-7xl xl:max-w-[1440px] mx-auto">
        <SkeletonBar width="200px" height="22px" style={{ marginBottom: '8px' }} />
        <SkeletonBar width="320px" height="12px" style={{ marginBottom: '24px' }} />
        <SkeletonStatGrid />
        <SkeletonStatGrid />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '32px' }} className="max-w-7xl xl:max-w-[1440px] mx-auto">
        <div style={{ border: '1px solid #E5E7EB' }}>
          <EmptyState
            type={!navigator.onLine ? 'offline' : 'error'}
            message={!navigator.onLine ? 'Device is offline. Reconnect to load population statistics.' : 'Could not load population statistics from the database.'}
            detail={error}
            action={{ label: 'Retry', onClick: () => window.location.reload() }}
          />
        </div>
      </div>
    );
  }

  // Expanded Theme Palette (8 Muted Earthy & Nature Tones)
  const colors = {
    forestGreen: '#2E7D32', // 1
    earthyBrown: '#8D6E63', // 2
    slateGray:   '#4A6572', // 3
    mutedClay:   '#A1887F', // 4
    oliveGreen:  '#6B8E23', // 5
    tealDusk:    '#00695C', // 6
    rustSienna:  '#A0522D', // 7
    stoneGray:   '#546E7A', // 8
    black:       '#1A1A1A'
  };

  return (
    <div className="flex flex-col gap-8 p-6 sm:p-8 xl:p-10 max-w-7xl xl:max-w-[1440px] mx-auto bg-white">
      <style>{`
        .tps-stats-toolbar { display: flex; justify-content: flex-end; gap: 10px; margin-top: 24px; padding-top: 16px; border-top: 1px solid #E5E7EB; }
        @media (max-width: 639px) {
          .tps-stats-toolbar { flex-direction: column; }
          .tps-stats-toolbar button { width: 100%; justify-content: center; }
          .tps-section-card { padding: 16px !important; margin-bottom: 16px !important; }
        }
      `}</style>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6 sm:mb-8">
        <div>
          <h2 style={{ fontSize: '20px', margin: '0 0 8px 0', color: '#1A1A1A', fontWeight: '500', letterSpacing: '0.02em' }}>
            POPULATION STATISTICS
          </h2>
          <p style={{ margin: 0, color: '#737373', fontSize: '12px' }}>
            Comprehensive statistics on district populations, age groups, religions, and nationalities.
          </p>
        </div>
        <button
          onClick={() => { clearCache(); loadDistricts(); loadStats(true); }}
          className="w-full sm:w-auto flex items-center justify-center gap-1.5"
          style={{ fontSize: '11px', border: '1px solid #E5E7EB', background: 'none', color: '#737373', padding: '6px 14px', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.05em', flexShrink: 0, marginTop: '4px' }}
          title="Fetch latest data from database"
        >
          ↻ Refresh Data
        </button>
      </div>

      {/* ─── Filter Section ────────────────────────────────── */}
      <div style={sectionCardStyle} className={sectionCardClass}>
        <div style={sectionTitleStyle}>
          <Search size={14} color={colors.black} /> FILTER BY LOCATION
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 xl:gap-5">
          {/* District */}
          <div>
            <label style={{ fontSize: '11px', fontWeight: '500', color: '#737373', display: 'block', letterSpacing: '0.02em' }}>
              ခရိုင် (DISTRICT)
            </label>
            <CustomLocationSelect
              value={selectedDistrict}
              onChange={(val) => setSelectedDistrict(val)}
              options={districts}
              placeholder={isMobile ? "--- အားလုံး (All) ---" : "--- အားလုံး (All Districts) ---"}
              disabled={false}
              isMobile={isMobile}
            />
          </div>

          {/* Township */}
          <div>
            <label style={{ fontSize: '11px', fontWeight: '500', color: '#737373', display: 'block', letterSpacing: '0.02em' }}>
              မြို့နယ် (TOWNSHIP)
            </label>
            <CustomLocationSelect
              value={selectedTownship}
              onChange={(val) => setSelectedTownship(val)}
              options={townships}
              placeholder={isMobile ? "--- အားလုံး (All) ---" : "--- အားလုံး (All Townships) ---"}
              disabled={!selectedDistrict}
              isMobile={isMobile}
            />
          </div>

          {/* Ward */}
          <div>
            <label style={{ fontSize: '11px', fontWeight: '500', color: '#737373', display: 'block', letterSpacing: '0.02em' }}>
              ရပ်ကွက် (WARD)
            </label>
            <CustomLocationSelect
              value={selectedWard}
              onChange={(val) => { setSelectedWard(val); setPage1(1); setPage2(1); }}
              options={wards}
              placeholder={isMobile ? "--- အားလုံး (All) ---" : "--- အားလုံး (All Wards) ---"}
              disabled={!selectedTownship}
              isMobile={isMobile}
            />
          </div>

          {/* Group */}
          <div>
            <label style={{ fontSize: '11px', fontWeight: '500', color: '#737373', display: 'block', letterSpacing: '0.02em' }}>
              အုပ်စု (GROUP)
            </label>
            <CustomLocationSelect
              value={selectedGroup}
              onChange={(val) => { setSelectedGroup(val); setPage1(1); setPage2(1); }}
              options={groups}
              placeholder={isMobile ? "--- အားလုံး (All) ---" : "--- အားလုံး (All Groups) ---"}
              disabled={!selectedTownship || !!selectedWard}
              isMobile={isMobile}
            />
          </div>

          {/* Village */}
          <div>
            <label style={{ fontSize: '11px', fontWeight: '500', color: '#737373', display: 'block', letterSpacing: '0.02em' }}>
              ကျေးရွာ (VILLAGE)
            </label>
            <CustomLocationSelect
              value={selectedVillage}
              onChange={(val) => { setSelectedVillage(val); setPage1(1); setPage2(1); }}
              options={filteredVillages}
              placeholder={isMobile ? "--- အားလုံး (All) ---" : "--- အားလုံး (All Villages) ---"}
              disabled={!selectedGroup}
              isMobile={isMobile}
            />
          </div>
        </div>

        {/* Active filter breadcrumb */}
        {selectedDistrict && (
          <div style={{ marginTop: '16px', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', color: '#737373', textTransform: 'uppercase' }}>Active Filters:</span>
            <span style={{ fontSize: '11px', border: `1px solid ${colors.forestGreen}`, padding: '2px 8px', color: colors.forestGreen, fontWeight: '500' }}>
              {selectedDistrict}
            </span>
            {selectedTownship && (
              <span style={{ fontSize: '11px', border: `1px solid ${colors.forestGreen}`, padding: '2px 8px', color: colors.forestGreen, fontWeight: '500' }}>
                {selectedTownship}
              </span>
            )}
            {selectedWard && (
              <span style={{ fontSize: '11px', border: `1px solid ${colors.forestGreen}`, padding: '2px 8px', color: colors.forestGreen, fontWeight: '500' }}>
                {selectedWard}
              </span>
            )}
            {selectedGroup && (
              <span style={{ fontSize: '11px', border: `1px solid ${colors.forestGreen}`, padding: '2px 8px', color: colors.forestGreen, fontWeight: '500' }}>
                {selectedGroup}
              </span>
            )}
            {selectedVillage && (
              <span style={{ fontSize: '11px', border: `1px solid ${colors.forestGreen}`, padding: '2px 8px', color: colors.forestGreen, fontWeight: '500' }}>
                {selectedVillage}
              </span>
            )}
            <button onClick={() => { setSelectedDistrict(''); setSelectedTownship(''); setSelectedWard(''); setSelectedVillage(''); setSelectedGroup(''); }}
              style={{ fontSize: '11px', border: `1px solid ${colors.black}`, background: 'none', color: colors.black, padding: '2px 8px', cursor: 'pointer', textTransform: 'uppercase' }}>
              Clear
            </button>
          </div>
        )}
      </div>

      {/* ─── Loading Circle in Gap when filtering ────────────── */}
      {loading && (
        <div className="tps-panel-enter flex items-center justify-center gap-2 py-3 px-4 my-2 bg-gray-50 border border-gray-200">
          <Loader2 size={16} className="animate-spin text-gray-900" />
          <span className="text-xs font-semibold text-gray-900 uppercase tracking-wider">
            Updating Statistics Data...
          </span>
        </div>
      )}

      {/* ─── Summary Cards ─────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 xl:gap-5 mb-4 sm:mb-6">
        <StatCard label="Total Population" value={totalPopulation} icon={Users} color={colors.forestGreen} />
        <StatCard label="Male" value={totalMale} icon={User} color={colors.slateGray} />
        <StatCard label="Female" value={totalFemale} icon={User} color={colors.mutedClay} />
        <StatCard label="Households" value={totalStats.households || 0} icon={Home} color={colors.earthyBrown} />
      </div>

      {/* ─── Age Distribution ──────────────────────────────── */}
      <div style={sectionCardStyle} className={sectionCardClass}>
        <div style={sectionTitleStyle}>
          <BarChart2 size={14} color={colors.black} /> AGE DISTRIBUTION
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4 xl:gap-5">
          <div style={{ padding: '24px', border: `1px solid ${colors.slateGray}`, textAlign: 'center' }}>
            <div style={{ fontSize: '10px', color: '#737373', fontWeight: '600', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Under 16</div>
            <div style={{ fontSize: '11px', color: '#737373', marginBottom: '12px' }}>အသက် ၁၆ နှစ်အောက်</div>
            <div style={{ fontSize: '32px', fontWeight: '500', color: colors.slateGray, fontFamily: 'var(--font-mono)' }}>{toMyanmarNum(under16)}</div>
          </div>
          <div style={{ padding: '24px', border: `1px solid ${colors.forestGreen}`, textAlign: 'center' }}>
            <div style={{ fontSize: '10px', color: '#737373', fontWeight: '600', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>16 – 60</div>
            <div style={{ fontSize: '11px', color: '#737373', marginBottom: '12px' }}>အသက် ၁၆ - ၆၀ နှစ်</div>
            <div style={{ fontSize: '32px', fontWeight: '500', color: colors.forestGreen, fontFamily: 'var(--font-mono)' }}>{toMyanmarNum(between16and60)}</div>
          </div>
          <div style={{ padding: '24px', border: `1px solid ${colors.earthyBrown}`, textAlign: 'center' }}>
            <div style={{ fontSize: '10px', color: '#737373', fontWeight: '600', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Above 60</div>
            <div style={{ fontSize: '11px', color: '#737373', marginBottom: '12px' }}>အသက် ၆၀ နှစ်အထက်</div>
            <div style={{ fontSize: '32px', fontWeight: '500', color: colors.earthyBrown, fontFamily: 'var(--font-mono)' }}>{toMyanmarNum(above60)}</div>
          </div>
          {unknownAge > 0 && (
            <div style={{ padding: '24px', border: `1px solid ${colors.mutedClay}`, textAlign: 'center' }}>
              <div style={{ fontSize: '10px', color: '#737373', fontWeight: '600', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Unknown</div>
              <div style={{ fontSize: '11px', color: '#737373', marginBottom: '12px' }}>အသက်မသိ</div>
              <div style={{ fontSize: '32px', fontWeight: '400', color: colors.mutedClay, fontFamily: 'var(--font-mono)' }}>{toMyanmarNum(unknownAge)}</div>
            </div>
          )}
        </div>
      </div>

      {/* ─── Comprehensive Summary Tables ─────────────────────── */}
      {(() => {
        // Group label based on filter level
        const groupLabel = selectedVillage || selectedGroup
          ? 'ကျေးရွာ'
          : selectedWard
            ? 'ရပ်ကွက်'
            : selectedTownship
              ? 'ရပ်ကွက်/အုပ်စု'
              : selectedDistrict
                ? 'မြို့နယ်'
                : 'ခရိုင်';

        // Level suffix for table titles
        const levelSuffix = selectedTownship
          ? '(WARD / GROUP / VILLAGE)'
          : selectedDistrict
            ? '(TOWNSHIP)'
            : '(DISTRICT)';

        // RPC returns pre-computed groupStats; split by kind when at ward/village/group level
        const isAtWardLevel = statsData?.groupKey === 'wvg';

        let wardStatsList = [];
        let villageStatsList = [];
        let groupStatsList = [];

        if (isAtWardLevel) {
          // If we have selected a group or a ward, pull from the cached township sub-locations
          const sourceStats = (selectedGroup || selectedWard)
            ? townshipLocations
            : (groupStats || []);

          sourceStats.forEach(g => {
            if (g.kind === 'ward') wardStatsList.push(g);
            else if (g.kind === 'village') villageStatsList.push(g);
            else if (g.kind === 'group') groupStatsList.push(g);
            else wardStatsList.push(g); // Unknown goes to ward
          });
        } else {
          // Use groupStats directly for district/township level
          wardStatsList = groupStats || [];
        }

        // Prefix village names with group name and filter to only those in the group, and by selectedVillage if active
        const prefixedVillageStatsList = selectedGroup
          ? villageStatsList
              .filter(v => filteredVillages.includes(v.name) && (!selectedVillage || v.name === selectedVillage))
              .map(v => ({ ...v, name: `${selectedGroup} — ${v.name}` }))
          : villageStatsList;

        // Pagination for combined view
        const totalPages1 = Math.max(1, Math.ceil(wardStatsList.length / PAGE_SIZE));
        const totalPages2 = Math.max(1, Math.ceil(wardStatsList.length / PAGE_SIZE));
        const pagedStats1 = wardStatsList.slice((page1 - 1) * PAGE_SIZE, page1 * PAGE_SIZE);
        const pagedStats2 = wardStatsList.slice((page2 - 1) * PAGE_SIZE, page2 * PAGE_SIZE);

        // Pagination for separate views
        const wardPages1 = Math.max(1, Math.ceil(wardStatsList.length / PAGE_SIZE));
        const wardPages2 = Math.max(1, Math.ceil(wardStatsList.length / PAGE_SIZE));
        const villagePages1 = Math.max(1, Math.ceil(prefixedVillageStatsList.length / PAGE_SIZE));
        const villagePages2 = Math.max(1, Math.ceil(prefixedVillageStatsList.length / PAGE_SIZE));
        const groupPages1 = Math.max(1, Math.ceil(groupStatsList.length / PAGE_SIZE));
        const groupPages2 = Math.max(1, Math.ceil(groupStatsList.length / PAGE_SIZE));

        const thS = { padding: '12px 8px', fontSize: '10px', fontWeight: '600', color: '#737373', borderBottom: '1px solid #E5E7EB', borderRight: '1px solid #E5E7EB', textAlign: 'center', whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: '0.05em', backgroundColor: '#FAFAFA' };
        const tdS = { padding: '10px 8px', fontSize: '12px', textAlign: 'center', borderBottom: '1px solid #E5E7EB', borderRight: '1px solid #E5E7EB', color: '#1A1A1A' };
        const tdMonoS = { ...tdS, fontFamily: 'var(--font-mono)' };
        const tdBold = { ...tdMonoS, fontWeight: '600', backgroundColor: '#FAFAFA' };

        const activeStatsForPrint = selectedGroup
          ? prefixedVillageStatsList
          : wardStatsList;

        const printArgs = {
          groupLabel,
          wardStats: activeStatsForPrint,
          totalStats, allReligions, allNationalities,
          selectedDistrict, selectedTownship, selectedWard, selectedGroup, selectedVillage,
          isAtWardLevel,
          wardStatsList, villageStatsList, groupStatsList,
        };

        // Helper to render table row
        const renderTableRow = (w, i, pageNum, stats) => (
          <tr key={w.name} style={{ backgroundColor: '#FFFFFF' }}>
            <td style={tdMonoS}>{toMyanmarNum((pageNum - 1) * PAGE_SIZE + i + 1)}</td>
            <td style={{ ...tdS, textAlign: 'left', fontWeight: '500', whiteSpace: 'normal', wordBreak: 'break-word', maxWidth: '180px' }}>{w.name}</td>
            <td style={tdMonoS}>{toMyanmarNum(w.households)}</td>
            <td style={tdMonoS}>{toMyanmarNum(w.male)}</td>
            <td style={tdMonoS}>{toMyanmarNum(w.female)}</td>
            <td style={{ ...tdMonoS, fontWeight: '600', color: colors.black }}>{toMyanmarNum(w.total)}</td>
            <td style={tdMonoS}>{toMyanmarNum(w.u16m)}</td>
            <td style={tdMonoS}>{toMyanmarNum(w.u16f)}</td>
            <td style={{ ...tdMonoS, fontWeight: '600', color: colors.black }}>{toMyanmarNum(w.u16m + w.u16f)}</td>
            <td style={tdMonoS}>{toMyanmarNum(w.b1660m)}</td>
            <td style={tdMonoS}>{toMyanmarNum(w.b1660f)}</td>
            <td style={{ ...tdMonoS, fontWeight: '600', color: colors.black }}>{toMyanmarNum(w.b1660m + w.b1660f)}</td>
            <td style={tdMonoS}>{toMyanmarNum(w.a60m)}</td>
            <td style={tdMonoS}>{toMyanmarNum(w.a60f)}</td>
            <td style={{ ...tdMonoS, fontWeight: '600', color: colors.black }}>{toMyanmarNum(w.a60m + w.a60f)}</td>
            {allReligions.map(r => <td key={r} style={tdMonoS}>{w.relCounts[r] ? toMyanmarNum(w.relCounts[r]) : '-'}</td>)}
          </tr>
        );

        // Render table 2 (Population + Nationality)
        const renderTable2 = (title, statsArray, pageNum, setPageFunc, totalPages) => {
          if (statsArray.length === 0) return null;
          const pagedStats = statsArray.slice((pageNum - 1) * PAGE_SIZE, pageNum * PAGE_SIZE);

          // Calculate correct sums for this specific table (statsArray)
          const tableSum = statsArray.reduce((acc, w) => {
            acc.male   += (w.male || 0);
            acc.female += (w.female || 0);
            acc.total  += (w.total || 0);
            uniqueNormalizedNats.forEach(n => {
              acc.natCounts[n] = (acc.natCounts[n] || 0) + getAggregatedNatCount(w.natCounts, n);
            });
            return acc;
          }, { male: 0, female: 0, total: 0, natCounts: {} });

          return (
            <div style={sectionCardStyle}>
              <div style={sectionTitleStyle}>{title}</div>
              <div className="tps-responsive-table">
                <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #E5E7EB', minWidth: '600px' }}>
                  <thead>
                    <tr>
                      <th rowSpan={2} style={{ ...thS, width: '3%' }}>စဉ်</th>
                      <th rowSpan={2} style={{ ...thS, minWidth: '120px', maxWidth: '180px', whiteSpace: 'normal', wordBreak: 'break-word' }}>အမည်</th>
                      <th colSpan={3} style={thS}>လူဦးရေပေါင်း</th>
                      {uniqueNormalizedNats.length > 0 && <th colSpan={uniqueNormalizedNats.length} style={thS}>လူမျိုးအလိုက်</th>}
                    </tr>
                    <tr>
                      <th style={thS}>ကျား</th><th style={thS}>မ</th><th style={thS}>ပေါင်း</th>
                      {uniqueNormalizedNats.map(n => <th key={n} style={thS}>{n}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {pagedStats.map((w, i) => (
                      <tr key={w.name} style={{ backgroundColor: '#FFFFFF' }}>
                        <td style={tdMonoS}>{toMyanmarNum((pageNum - 1) * PAGE_SIZE + i + 1)}</td>
                        <td style={{ ...tdS, textAlign: 'left', fontWeight: '500', whiteSpace: 'normal', wordBreak: 'break-word', maxWidth: '180px' }}>{w.name}</td>
                        <td style={tdMonoS}>{toMyanmarNum(w.male)}</td>
                        <td style={tdMonoS}>{toMyanmarNum(w.female)}</td>
                        <td style={{ ...tdMonoS, fontWeight: '600', color: colors.black }}>{toMyanmarNum(w.total)}</td>
                        {uniqueNormalizedNats.map(n => <td key={n} style={tdMonoS}>{toMyanmarNum(getAggregatedNatCount(w.natCounts, n)) || '-'}</td>)}
                      </tr>
                    ))}
                    <tr>
                      <td style={tdBold}></td>
                      <td style={{ ...tdS, textAlign: 'left', fontWeight: '600', backgroundColor: '#FAFAFA' }}>စုစုပေါင်း</td>
                      <td style={tdBold}>{toMyanmarNum(tableSum.male)}</td>
                      <td style={tdBold}>{toMyanmarNum(tableSum.female)}</td>
                      <td style={{ ...tdBold, color: colors.black }}>{toMyanmarNum(tableSum.total)}</td>
                      {uniqueNormalizedNats.map(n => <td key={n} style={tdBold}>{tableSum.natCounts[n] ? toMyanmarNum(tableSum.natCounts[n]) : '-'}</td>)}
                    </tr>
                  </tbody>
                </table>
              </div>
              {statsArray.length > PAGE_SIZE && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0 4px', borderTop: '1px solid #E5E7EB', marginTop: '4px' }}>
                  <span style={{ fontSize: '11px', color: '#737373' }}>
                    {toMyanmarNum((pageNum - 1) * PAGE_SIZE + 1)}–{toMyanmarNum(Math.min(pageNum * PAGE_SIZE, statsArray.length))} / {toMyanmarNum(statsArray.length)} rows
                  </span>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button onClick={() => setPageFunc(p => Math.max(1, p - 1))} disabled={pageNum === 1}
                      style={{ padding: '4px 12px', border: '1px solid #E5E7EB', background: pageNum === 1 ? '#F9FAFB' : '#FFFFFF', color: pageNum === 1 ? '#D1D5DB' : '#1A1A1A', fontSize: '11px', cursor: pageNum === 1 ? 'default' : 'pointer' }}>
                      ← Prev
                    </button>
                    <span style={{ padding: '4px 10px', fontSize: '11px', color: '#1A1A1A', border: '1px solid #E5E7EB', background: '#FAFAFA' }}>
                      {toMyanmarNum(pageNum)} / {toMyanmarNum(totalPages)}
                    </span>
                    <button onClick={() => setPageFunc(p => Math.min(totalPages, p + 1))} disabled={pageNum === totalPages}
                      style={{ padding: '4px 12px', border: '1px solid #E5E7EB', background: pageNum === totalPages ? '#F9FAFB' : '#FFFFFF', color: pageNum === totalPages ? '#D1D5DB' : '#1A1A1A', fontSize: '11px', cursor: pageNum === totalPages ? 'default' : 'pointer' }}>
                      Next →
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        };

        // Render table 1 (Population + Age + Religious)
        const renderTable1 = (title, statsArray, pageNum, setPageFunc, totalPages) => {
          if (statsArray.length === 0) return null;
          const pagedStats = statsArray.slice((pageNum - 1) * PAGE_SIZE, pageNum * PAGE_SIZE);

          // Calculate correct sums for this specific table (statsArray)
          const tableSum = statsArray.reduce((acc, w) => {
            acc.households += (w.households || 0);
            acc.male       += (w.male || 0);
            acc.female     += (w.female || 0);
            acc.total      += (w.total || 0);
            acc.u16m       += (w.u16m || 0);
            acc.u16f       += (w.u16f || 0);
            acc.b1660m     += (w.b1660m || 0);
            acc.b1660f     += (w.b1660f || 0);
            acc.a60m       += (w.a60m || 0);
            acc.a60f       += (w.a60f || 0);
            allReligions.forEach(r => {
              acc.relCounts[r] = (acc.relCounts[r] || 0) + (w.relCounts?.[r] || 0);
            });
            return acc;
          }, {
            households: 0, male: 0, female: 0, total: 0,
            u16m: 0, u16f: 0, b1660m: 0, b1660f: 0, a60m: 0, a60f: 0,
            relCounts: {}
          });

          return (
            <div style={sectionCardStyle}>
              <div style={sectionTitleStyle}>{title}</div>
              <div className="tps-responsive-table">
                <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #E5E7EB', minWidth: '900px' }}>
                  <thead>
                    <tr>
                      <th rowSpan={2} style={{ ...thS, width: '3%' }}>စဉ်</th>
                      <th rowSpan={2} style={{ ...thS, minWidth: '120px', maxWidth: '180px', whiteSpace: 'normal', wordBreak: 'break-word' }}>အမည်</th>
                      <th rowSpan={2} style={thS}>အထစ</th>
                      <th colSpan={3} style={thS}>လူဦးရေပေါင်း</th>
                      <th colSpan={3} style={thS}>၁၆ နှစ်အောက်</th>
                      <th colSpan={3} style={thS}>၁၆ - ၆၀ နှစ်အကြား</th>
                      <th colSpan={3} style={thS}>၆၀ နှစ်အထက်</th>
                      {allReligions.length > 0 && <th colSpan={allReligions.length} style={thS}>ကိုးကွယ်သည့်ဘာသာ</th>}
                    </tr>
                    <tr>
                      <th style={thS}>ကျား</th><th style={thS}>မ</th><th style={thS}>ပေါင်း</th>
                      <th style={thS}>ကျား</th><th style={thS}>မ</th><th style={thS}>ပေါင်း</th>
                      <th style={thS}>ကျား</th><th style={thS}>မ</th><th style={thS}>ပေါင်း</th>
                      <th style={thS}>ကျား</th><th style={thS}>မ</th><th style={thS}>ပေါင်း</th>
                      {allReligions.map(r => <th key={r} style={thS}>{r}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {pagedStats.map((w, i) => renderTableRow(w, i, pageNum, statsArray))}
                    <tr>
                      <td style={tdBold}></td>
                      <td style={{ ...tdS, textAlign: 'left', fontWeight: '600', backgroundColor: '#FAFAFA' }}>စုစုပေါင်း</td>
                      <td style={tdBold}>{toMyanmarNum(tableSum.households)}</td>
                      <td style={tdBold}>{toMyanmarNum(tableSum.male)}</td>
                      <td style={tdBold}>{toMyanmarNum(tableSum.female)}</td>
                      <td style={{ ...tdBold, color: colors.black }}>{toMyanmarNum(tableSum.total)}</td>
                      <td style={tdBold}>{toMyanmarNum(tableSum.u16m)}</td>
                      <td style={tdBold}>{toMyanmarNum(tableSum.u16f)}</td>
                      <td style={{ ...tdBold, color: colors.black }}>{toMyanmarNum(tableSum.u16m + tableSum.u16f)}</td>
                      <td style={tdBold}>{toMyanmarNum(tableSum.b1660m)}</td>
                      <td style={tdBold}>{toMyanmarNum(tableSum.b1660f)}</td>
                      <td style={{ ...tdBold, color: colors.black }}>{toMyanmarNum(tableSum.b1660m + tableSum.b1660f)}</td>
                      <td style={tdBold}>{toMyanmarNum(tableSum.a60m)}</td>
                      <td style={tdBold}>{toMyanmarNum(tableSum.a60f)}</td>
                      <td style={{ ...tdBold, color: colors.black }}>{toMyanmarNum(tableSum.a60m + tableSum.a60f)}</td>
                      {allReligions.map(r => <td key={r} style={tdBold}>{tableSum.relCounts[r] ? toMyanmarNum(tableSum.relCounts[r]) : '-'}</td>)}
                    </tr>
                  </tbody>
                </table>
              </div>
              {statsArray.length > PAGE_SIZE && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0 4px', borderTop: '1px solid #E5E7EB', marginTop: '4px' }}>
                  <span style={{ fontSize: '11px', color: '#737373' }}>
                    {toMyanmarNum((pageNum - 1) * PAGE_SIZE + 1)}–{toMyanmarNum(Math.min(pageNum * PAGE_SIZE, statsArray.length))} / {toMyanmarNum(statsArray.length)} rows
                  </span>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button onClick={() => setPageFunc(p => Math.max(1, p - 1))} disabled={pageNum === 1}
                      style={{ padding: '4px 12px', border: '1px solid #E5E7EB', background: pageNum === 1 ? '#F9FAFB' : '#FFFFFF', color: pageNum === 1 ? '#D1D5DB' : '#1A1A1A', fontSize: '11px', cursor: pageNum === 1 ? 'default' : 'pointer' }}>
                      ← Prev
                    </button>
                    <span style={{ padding: '4px 10px', fontSize: '11px', color: '#1A1A1A', border: '1px solid #E5E7EB', background: '#FAFAFA' }}>
                      {toMyanmarNum(pageNum)} / {toMyanmarNum(totalPages)}
                    </span>
                    <button onClick={() => setPageFunc(p => Math.min(totalPages, p + 1))} disabled={pageNum === totalPages}
                      style={{ padding: '4px 12px', border: '1px solid #E5E7EB', background: pageNum === totalPages ? '#F9FAFB' : '#FFFFFF', color: pageNum === totalPages ? '#D1D5DB' : '#1A1A1A', fontSize: '11px', cursor: pageNum === totalPages ? 'default' : 'pointer' }}>
                      Next →
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        };

        return (
          <>
            {isAtWardLevel ? (
              <>
                {selectedVillage ? (
                  <>
                    {/* ── Villages Group (Summary Table 1 & 2) ── */}
                    {renderTable1(`SUMMARY TABLE (1) — POPULATION, AGE & RELIGION (VILLAGES)`, prefixedVillageStatsList, villagePage1, setVillagePage1, villagePages1)}
                    {renderTable2(`SUMMARY TABLE (2) — NATIONALITY (VILLAGES)`, prefixedVillageStatsList, villagePage2, setVillagePage2, villagePages2)}
                  </>
                ) : selectedGroup ? (
                  <>
                    {/* ── Grand Total (Group Wide) ── */}
                    {renderTable1(`GRAND TOTAL — POPULATION, AGE & RELIGION (GROUP WIDE)`, [{ name: selectedGroup, ...totalStats }], 1, () => {}, 1)}
                    {renderTable2(`GRAND TOTAL — NATIONALITY (GROUP WIDE)`, [{ name: selectedGroup, ...totalStats }], 1, () => {}, 1)}

                    {/* ── Villages Group (Summary Table 1 & 2) ── */}
                    {renderTable1(`SUMMARY TABLE (1) — POPULATION, AGE & RELIGION (VILLAGES)`, prefixedVillageStatsList, villagePage1, setVillagePage1, villagePages1)}
                    {renderTable2(`SUMMARY TABLE (2) — NATIONALITY (VILLAGES)`, prefixedVillageStatsList, villagePage2, setVillagePage2, villagePages2)}
                  </>
                ) : selectedWard ? (
                  <>
                    {/* ── Grand Total (Ward Wide) ── */}
                    {renderTable1(`GRAND TOTAL — POPULATION, AGE & RELIGION (WARD WIDE)`, [{ name: selectedWard, ...totalStats }], 1, () => {}, 1)}
                    {renderTable2(`GRAND TOTAL — NATIONALITY (WARD WIDE)`, [{ name: selectedWard, ...totalStats }], 1, () => {}, 1)}

                    {/* ── Wards Group (Summary Table 1 & 2) ── */}
                    {renderTable1(`SUMMARY TABLE (1) — POPULATION, AGE & RELIGION (WARDS)`, wardStatsList, wardPage1, setWardPage1, wardPages1)}
                    {renderTable2(`SUMMARY TABLE (2) — NATIONALITY (WARDS)`, wardStatsList, wardPage2, setWardPage2, wardPages2)}
                  </>
                ) : (
                  <>
                    {/* ── Grand Total (Township Wide) ── */}
                    {renderTable1(`GRAND TOTAL — POPULATION, AGE & RELIGION (TOWNSHIP WIDE)`, [{ name: selectedTownship || 'Township Total', ...totalStats }], 1, () => {}, 1)}
                    {renderTable2(`GRAND TOTAL — NATIONALITY (TOWNSHIP WIDE)`, [{ name: selectedTownship || 'Township Total', ...totalStats }], 1, () => {}, 1)}

                    {/* ── Wards Group (Summary Table 1 & 2) ── */}
                    {renderTable1(`SUMMARY TABLE (1) — POPULATION, AGE & RELIGION (WARDS)`, wardStatsList, wardPage1, setWardPage1, wardPages1)}
                    {renderTable2(`SUMMARY TABLE (2) — NATIONALITY (WARDS)`, wardStatsList, wardPage2, setWardPage2, wardPages2)}

                    {/* ── Groups Group (Summary Table 1 & 2) ── */}
                    {renderTable1(`SUMMARY TABLE (1) — POPULATION, AGE & RELIGION (GROUPS)`, groupStatsList, groupPage1, setGroupPage1, groupPages1)}
                    {renderTable2(`SUMMARY TABLE (2) — NATIONALITY (GROUPS)`, groupStatsList, groupPage2, setGroupPage2, groupPages2)}
                  </>
                )}
              </>
            ) : (
              <>
                {/* ── Table 1: Population + Age + Religious ─────── */}
                <div style={sectionCardStyle}>
                  <div style={sectionTitleStyle}>{`SUMMARY TABLE (1) — POPULATION, AGE & RELIGION ${levelSuffix}`}</div>
                  <div className="tps-responsive-table">
                    <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #E5E7EB', minWidth: '900px' }}>
                      <thead>
                        <tr>
                          <th rowSpan={2} style={thS}>စဉ်</th>
                          <th rowSpan={2} style={thS}>{groupLabel}</th>
                          <th rowSpan={2} style={thS}>အထစ</th>
                          <th colSpan={3} style={thS}>လူဦးရေပေါင်း</th>
                          <th colSpan={3} style={thS}>၁၆ နှစ်အောက်</th>
                          <th colSpan={3} style={thS}>၁၆ - ၆၀ နှစ်အကြား</th>
                          <th colSpan={3} style={thS}>၆၀ နှစ်အထက်</th>
                          {allReligions.length > 0 && <th colSpan={allReligions.length} style={thS}>ကိုးကွယ်သည့်ဘာသာ</th>}
                        </tr>
                        <tr>
                          <th style={thS}>ကျား</th><th style={thS}>မ</th><th style={thS}>ပေါင်း</th>
                          <th style={thS}>ကျား</th><th style={thS}>မ</th><th style={thS}>ပေါင်း</th>
                          <th style={thS}>ကျား</th><th style={thS}>မ</th><th style={thS}>ပေါင်း</th>
                          <th style={thS}>ကျား</th><th style={thS}>မ</th><th style={thS}>ပေါင်း</th>
                          {allReligions.map(r => <th key={r} style={thS}>{r}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {pagedStats1.map((w, i) => (
                          <tr key={w.name || i} style={{ backgroundColor: '#FFFFFF' }}>
                            <td style={tdMonoS}>{toMyanmarNum((page1 - 1) * PAGE_SIZE + i + 1)}</td>
                            <td style={{ ...tdS, textAlign: 'left', fontWeight: '500' }}>{w.name}</td>
                            <td style={tdMonoS}>{toMyanmarNum(w.households)}</td>
                            <td style={tdMonoS}>{toMyanmarNum(w.male)}</td>
                            <td style={tdMonoS}>{toMyanmarNum(w.female)}</td>
                            <td style={{ ...tdMonoS, fontWeight: '600', color: colors.black }}>{toMyanmarNum(w.total)}</td>
                            <td style={tdMonoS}>{toMyanmarNum(w.u16m)}</td>
                            <td style={tdMonoS}>{toMyanmarNum(w.u16f)}</td>
                            <td style={{ ...tdMonoS, fontWeight: '600', color: colors.black }}>{toMyanmarNum(w.u16m + w.u16f)}</td>
                            <td style={tdMonoS}>{toMyanmarNum(w.b1660m)}</td>
                            <td style={tdMonoS}>{toMyanmarNum(w.b1660f)}</td>
                            <td style={{ ...tdMonoS, fontWeight: '600', color: colors.black }}>{toMyanmarNum(w.b1660m + w.b1660f)}</td>
                            <td style={tdMonoS}>{toMyanmarNum(w.a60m)}</td>
                            <td style={tdMonoS}>{toMyanmarNum(w.a60f)}</td>
                            <td style={{ ...tdMonoS, fontWeight: '600', color: colors.black }}>{toMyanmarNum(w.a60m + w.a60f)}</td>
                            {allReligions.map(r => <td key={r} style={tdMonoS}>{w.relCounts[r] ? toMyanmarNum(w.relCounts[r]) : '-'}</td>)}
                          </tr>
                        ))}
                        {/* Total Row */}
                        <tr>
                          <td style={tdBold}></td>
                          <td style={{ ...tdS, textAlign: 'left', fontWeight: '600', backgroundColor: '#FAFAFA' }}>စုစုပေါင်း</td>
                          <td style={tdBold}>{toMyanmarNum(totalStats.households)}</td>
                          <td style={tdBold}>{toMyanmarNum(totalStats.male)}</td>
                          <td style={tdBold}>{toMyanmarNum(totalStats.female)}</td>
                          <td style={{ ...tdBold, color: colors.black }}>{toMyanmarNum(totalStats.total)}</td>
                          <td style={tdBold}>{toMyanmarNum(totalStats.u16m)}</td>
                          <td style={tdBold}>{toMyanmarNum(totalStats.u16f)}</td>
                          <td style={{ ...tdBold, color: colors.black }}>{toMyanmarNum(totalStats.u16m + totalStats.u16f)}</td>
                          <td style={tdBold}>{toMyanmarNum(totalStats.b1660m)}</td>
                          <td style={tdBold}>{toMyanmarNum(totalStats.b1660f)}</td>
                          <td style={{ ...tdBold, color: colors.black }}>{toMyanmarNum(totalStats.b1660m + totalStats.b1660f)}</td>
                          <td style={tdBold}>{toMyanmarNum(totalStats.a60m)}</td>
                          <td style={tdBold}>{toMyanmarNum(totalStats.a60f)}</td>
                          <td style={{ ...tdBold, color: colors.black }}>{toMyanmarNum(totalStats.a60m + totalStats.a60f)}</td>
                          {allReligions.map(r => <td key={r} style={tdBold}>{totalStats.relCounts[r] ? toMyanmarNum(totalStats.relCounts[r]) : '-'}</td>)}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  {wardStatsList.length > PAGE_SIZE && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0 4px', borderTop: '1px solid #E5E7EB', marginTop: '4px' }}>
                      <span style={{ fontSize: '11px', color: '#737373' }}>
                        {toMyanmarNum((page1 - 1) * PAGE_SIZE + 1)}–{toMyanmarNum(Math.min(page1 * PAGE_SIZE, wardStatsList.length))} / {toMyanmarNum(wardStatsList.length)} rows
                      </span>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button onClick={() => setPage1(p => Math.max(1, p - 1))} disabled={page1 === 1}
                          style={{ padding: '4px 12px', border: '1px solid #E5E7EB', background: page1 === 1 ? '#F9FAFB' : '#FFFFFF', color: page1 === 1 ? '#D1D5DB' : '#1A1A1A', fontSize: '11px', cursor: page1 === 1 ? 'default' : 'pointer' }}>
                          ← Prev
                        </button>
                        <span style={{ padding: '4px 10px', fontSize: '11px', color: '#1A1A1A', border: '1px solid #E5E7EB', background: '#FAFAFA' }}>
                          {toMyanmarNum(page1)} / {toMyanmarNum(totalPages1)}
                        </span>
                        <button onClick={() => setPage1(p => Math.min(totalPages1, p + 1))} disabled={page1 === totalPages1}
                          style={{ padding: '4px 12px', border: '1px solid #E5E7EB', background: page1 === totalPages1 ? '#F9FAFB' : '#FFFFFF', color: page1 === totalPages1 ? '#D1D5DB' : '#1A1A1A', fontSize: '11px', cursor: page1 === totalPages1 ? 'default' : 'pointer' }}>
                          Next →
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* ── Table 2: Population + Nationality ──────────── */}
                <div style={sectionCardStyle}>
                  <div style={sectionTitleStyle}>{`SUMMARY TABLE (2) — NATIONALITY ${levelSuffix}`}</div>
                  <div className="tps-responsive-table">
                    <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #E5E7EB', minWidth: '600px' }}>
                      <thead>
                        <tr>
                          <th rowSpan={2} style={thS}>စဉ်</th>
                          <th rowSpan={2} style={thS}>{groupLabel}</th>
                          <th colSpan={3} style={thS}>လူဦးရေပေါင်း</th>
                          {uniqueNormalizedNats.length > 0 && <th colSpan={uniqueNormalizedNats.length} style={thS}>လူမျိုးအလိုက်</th>}
                        </tr>
                        <tr>
                          <th style={thS}>ကျား</th><th style={thS}>မ</th><th style={thS}>ပေါင်း</th>
                          {uniqueNormalizedNats.map(n => <th key={n} style={thS}>{n}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {pagedStats2.map((w, i) => (
                          <tr key={w.name || i} style={{ backgroundColor: '#FFFFFF' }}>
                            <td style={tdMonoS}>{toMyanmarNum((page2 - 1) * PAGE_SIZE + i + 1)}</td>
                            <td style={{ ...tdS, textAlign: 'left', fontWeight: '500' }}>{w.name}</td>
                            <td style={tdMonoS}>{toMyanmarNum(w.male)}</td>
                            <td style={tdMonoS}>{toMyanmarNum(w.female)}</td>
                            <td style={{ ...tdMonoS, fontWeight: '600', color: colors.black }}>{toMyanmarNum(w.total)}</td>
                            {uniqueNormalizedNats.map(n => <td key={n} style={tdMonoS}>{toMyanmarNum(getAggregatedNatCount(w.natCounts, n)) || '-'}</td>)}
                          </tr>
                        ))}
                        {/* Total Row */}
                        <tr>
                          <td style={tdBold}></td>
                          <td style={{ ...tdS, textAlign: 'left', fontWeight: '600', backgroundColor: '#FAFAFA' }}>စုစုပေါင်း</td>
                          <td style={tdBold}>{toMyanmarNum(totalStats.male)}</td>
                          <td style={tdBold}>{toMyanmarNum(totalStats.female)}</td>
                          <td style={{ ...tdBold, color: colors.black }}>{toMyanmarNum(totalStats.total)}</td>
                          {uniqueNormalizedNats.map(n => <td key={n} style={tdBold}>{toMyanmarNum(aggregatedNatCounts[n]) || '-'}</td>)}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  {wardStatsList.length > PAGE_SIZE && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0 4px', borderTop: '1px solid #E5E7EB', marginTop: '4px' }}>
                      <span style={{ fontSize: '11px', color: '#737373' }}>
                        {toMyanmarNum((page2 - 1) * PAGE_SIZE + 1)}–{toMyanmarNum(Math.min(page2 * PAGE_SIZE, wardStatsList.length))} / {toMyanmarNum(wardStatsList.length)} rows
                      </span>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button onClick={() => setPage2(p => Math.max(1, p - 1))} disabled={page2 === 1}
                          style={{ padding: '4px 12px', border: '1px solid #E5E7EB', background: page2 === 1 ? '#F9FAFB' : '#FFFFFF', color: page2 === 1 ? '#D1D5DB' : '#1A1A1A', fontSize: '11px', cursor: page2 === 1 ? 'default' : 'pointer' }}>
                          ← Prev
                        </button>
                        <span style={{ padding: '4px 10px', fontSize: '11px', color: '#1A1A1A', border: '1px solid #E5E7EB', background: '#FAFAFA' }}>
                          {toMyanmarNum(page2)} / {toMyanmarNum(totalPages2)}
                        </span>
                        <button onClick={() => setPage2(p => Math.min(totalPages2, p + 1))} disabled={page2 === totalPages2}
                          style={{ padding: '4px 12px', border: '1px solid #E5E7EB', background: page2 === totalPages2 ? '#F9FAFB' : '#FFFFFF', color: page2 === totalPages2 ? '#D1D5DB' : '#1A1A1A', fontSize: '11px', cursor: page2 === totalPages2 ? 'default' : 'pointer' }}>
                          Next →
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* ── Print / Export toolbar ─────────────────────── */}
            {isViewer ? (
              <div className="tps-stats-toolbar">
                {approvedTypes.has('excel') ? (
                  <button type="button" onClick={() => { exportStatisticsExcel(printArgs); markUsed('excel'); }}
                    style={{ display:'flex', alignItems:'center', gap:'6px', padding:'8px 16px', border:'1px solid #065F46', backgroundColor:'#F0FDF4', color:'#065F46', fontSize:'11px', fontWeight:'600', cursor:'pointer', textTransform:'uppercase', letterSpacing:'0.05em' }}>
                    <FileSpreadsheet size={13} /> Export Excel (Approved)
                  </button>
                ) : (
                  <button type="button" onClick={() => submitRequest('excel')} disabled={reqSending || reqSent === 'excel'}
                    style={{ display:'flex', alignItems:'center', gap:'6px', padding:'8px 16px', border:'1px solid #1A1A1A', backgroundColor:'#FFFFFF', color:'#1A1A1A', fontSize:'11px', fontWeight:'500', cursor: reqSending ? 'not-allowed' : 'pointer', textTransform:'uppercase', letterSpacing:'0.05em', opacity: reqSent === 'excel' ? 0.6 : 1 }}>
                    {reqSent === 'excel' ? <><CheckCircle2 size={13} /> Requested</> : <><Send size={13} /> Request Excel Export</>}
                  </button>
                )}
                {approvedTypes.has('print') ? (
                  <button type="button" onClick={() => { printStatistics(printArgs); markUsed('print'); }}
                    onMouseOver={e => { e.currentTarget.style.backgroundColor='#065F46'; }}
                    onMouseOut={e => { e.currentTarget.style.backgroundColor='#15803D'; }}
                    style={{ display:'flex', alignItems:'center', gap:'6px', padding:'8px 16px', border:'1px solid #15803D', backgroundColor:'#15803D', color:'#FFFFFF', fontSize:'11px', fontWeight:'600', cursor:'pointer', textTransform:'uppercase', letterSpacing:'0.05em', transition:'background-color 120ms' }}>
                    <Printer size={13} /> Print — Legal (Approved)
                  </button>
                ) : (
                  <button type="button" onClick={() => submitRequest('print')} disabled={reqSending || reqSent === 'print'}
                    style={{ display:'flex', alignItems:'center', gap:'6px', padding:'8px 16px', border:'1px solid #1A1A1A', backgroundColor:'#1A1A1A', color:'#FFFFFF', fontSize:'11px', fontWeight:'500', cursor: reqSending ? 'not-allowed' : 'pointer', textTransform:'uppercase', letterSpacing:'0.05em', opacity: reqSent === 'print' ? 0.6 : 1 }}>
                    {reqSent === 'print' ? <><CheckCircle2 size={13} /> Requested</> : <><Send size={13} /> Request Print</>}
                  </button>
                )}
                {approvedTypes.size > 0 && (
                  <span style={{ fontSize:'10px', color:'#065F46', fontWeight:'600', display:'flex', alignItems:'center', gap:'4px' }}>
                    <CheckCircle2 size={12} /> Permission granted by administrator.
                  </span>
                )}
                {reqSent && approvedTypes.size === 0 && (
                  <span style={{ fontSize:'10px', color:'#065F46', fontWeight:'600', display:'flex', alignItems:'center', gap:'4px' }}>
                    <CheckCircle2 size={12} /> Request sent. Administrator has been notified.
                  </span>
                )}
              </div>
            ) : (
              <div className="tps-stats-toolbar">
                <button type="button" onClick={() => exportStatisticsExcel(printArgs)}
                  style={{ display:'flex', alignItems:'center', gap:'6px', padding:'8px 16px', border:'1px solid #1A1A1A', backgroundColor:'#FFFFFF', color:'#1A1A1A', fontSize:'11px', fontWeight:'500', cursor:'pointer', textTransform:'uppercase', letterSpacing:'0.05em' }}>
                  <FileSpreadsheet size={13} /> Export Excel
                </button>
                <button type="button" onClick={() => printStatistics(printArgs)}
                  onMouseOver={e => { e.currentTarget.style.backgroundColor='#FFFFFF'; e.currentTarget.style.color='#1A1A1A'; }}
                  onMouseOut={e => { e.currentTarget.style.backgroundColor='#1A1A1A'; e.currentTarget.style.color='#FFFFFF'; }}
                  style={{ display:'flex', alignItems:'center', gap:'6px', padding:'8px 16px', border:'1px solid #1A1A1A', backgroundColor:'#1A1A1A', color:'#FFFFFF', fontSize:'11px', fontWeight:'500', cursor:'pointer', textTransform:'uppercase', letterSpacing:'0.05em', transition:'background-color 120ms cubic-bezier(0.23,1,0.32,1), color 120ms cubic-bezier(0.23,1,0.32,1)' }}>
                  <Printer size={13} /> Print (Legal)
                </button>
              </div>
            )}
          </>
        );
      })()}
    </div>
  );
};

export default PopulationStatistics;
