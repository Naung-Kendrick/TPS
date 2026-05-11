import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Users, User, Home, Search, BarChart2, MapPin, Globe } from 'lucide-react';

const toMyanmarNum = (num) => {
  const myanmarNumbers = ['၀', '၁', '၂', '၃', '၄', '၅', '၆', '၇', '၈', '၉'];
  return num.toString().split('').map(digit => myanmarNumbers[parseInt(digit)] || digit).join('');
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

// ─── Bar Chart ────────────────────────────────────────────
const HorizontalBar = ({ data, color = '#2E7D32' }) => {
  if (!data || data.length === 0) return <div style={{ padding: '1rem', color: '#737373', textAlign: 'center', fontSize: '12px' }}>အချက်အလက်မရှိပါ</div>;
  const maxVal = Math.max(...data.map(d => d.count), 1);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {data.map((item) => (
        <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '120px', fontSize: '11px', fontWeight: '500', color: '#1A1A1A', textAlign: 'right', flexShrink: 0 }}>{item.label || '—'}</div>
          <div style={{ flex: 1, height: '16px', backgroundColor: '#FAFAFA', border: '1px solid #E5E7EB', overflow: 'hidden', position: 'relative' }}>
            <div style={{
              height: '100%',
              backgroundColor: color,
              width: `${Math.max((item.count / maxVal) * 100, 1)}%`,
              transition: 'width 0.5s ease-out',
            }}>
            </div>
          </div>
          <div style={{ width: '50px', fontSize: '11px', fontWeight: '500', color: '#737373', flexShrink: 0, fontFamily: 'var(--font-mono)' }}>{toMyanmarNum(item.count)}</div>
        </div>
      ))}
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────
const PopulationStatistics = () => {
  const [allData, setAllData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [districts, setDistricts] = useState([]);
  const [townships, setTownships] = useState([]);
  const [wards, setWards] = useState([]);

  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [selectedTownship, setSelectedTownship] = useState('');
  const [selectedWard, setSelectedWard] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('households')
          .select('household_no, district, township, ward_village_group, gender, date_of_birth, religious, nationality, resident_status');

        if (error) throw error;
        setAllData(data || []);

        const uniqueDistricts = [...new Set((data || []).map(d => d.district).filter(Boolean))].sort();
        setDistricts(uniqueDistricts);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    if (selectedDistrict) {
      const filtered = allData.filter(d => d.district === selectedDistrict);
      const uniqueTownships = [...new Set(filtered.map(d => d.township).filter(Boolean))].sort();
      setTownships(uniqueTownships);
    } else {
      setTownships([]);
    }
    setSelectedTownship('');
    setSelectedWard('');
  }, [selectedDistrict, allData]);

  useEffect(() => {
    if (selectedTownship) {
      const filtered = allData.filter(d => d.district === selectedDistrict && d.township === selectedTownship);
      const uniqueWards = [...new Set(filtered.map(d => d.ward_village_group).filter(Boolean))].sort();
      setWards(uniqueWards);
    } else {
      setWards([]);
    }
    setSelectedWard('');
  }, [selectedTownship, selectedDistrict, allData]);

  const filteredData = useCallback(() => {
    let data = allData;
    if (selectedDistrict) data = data.filter(d => d.district === selectedDistrict);
    if (selectedTownship) data = data.filter(d => d.township === selectedTownship);
    if (selectedWard) data = data.filter(d => d.ward_village_group === selectedWard);
    return data;
  }, [allData, selectedDistrict, selectedTownship, selectedWard]);

  const currentData = filteredData();

  const totalPopulation = currentData.length;
  const totalMale = currentData.filter(d => d.gender && (d.gender === 'ကျား' || d.gender === 'က')).length;
  const totalFemale = currentData.filter(d => d.gender && d.gender === 'မ').length;

  const ages = currentData.map(d => calculateAge(d.date_of_birth)).filter(a => a !== null);
  const under16 = ages.filter(a => a < 16).length;
  const between16and60 = ages.filter(a => a >= 16 && a <= 60).length;
  const above60 = ages.filter(a => a > 60).length;
  const unknownAge = currentData.length - ages.length;

  const religiousMap = {};
  currentData.forEach(d => {
    const key = d.religious || 'အခြား';
    religiousMap[key] = (religiousMap[key] || 0) + 1;
  });
  const religiousData = Object.entries(religiousMap)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);

  const nationalityMap = {};
  currentData.forEach(d => {
    const key = d.nationality || 'အခြား';
    nationalityMap[key] = (nationalityMap[key] || 0) + 1;
  });
  const nationalityData = Object.entries(nationalityMap)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);

  const selectStyle = {
    width: '100%', padding: '8px 12px', borderRadius: '0px',
    border: '1px solid #E5E7EB', fontSize: '12px', fontFamily: 'Inter, sans-serif',
    backgroundColor: '#FFFFFF', boxSizing: 'border-box', marginTop: '4px',
    color: '#1A1A1A',
  };

  const sectionCardStyle = {
    backgroundColor: '#FFFFFF', borderRadius: '0px', border: '1px solid #E5E7EB',
    padding: '24px', marginBottom: '24px',
  };

  const sectionTitleStyle = {
    fontSize: '12px', fontWeight: '600', color: '#1A1A1A',
    marginBottom: '20px', paddingBottom: '10px', borderBottom: '1px solid #E5E7EB',
    display: 'flex', alignItems: 'center', gap: '8px',
    textTransform: 'uppercase', letterSpacing: '0.05em'
  };

  if (loading) {
    return (
      <div style={{ padding: '32px' }} className="max-w-7xl mx-auto">
        <div style={{ textAlign: 'center', padding: '64px', color: '#737373', fontSize: '12px' }}>
          <p>LOADING STATISTICS...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '32px' }} className="max-w-7xl mx-auto">
        <div style={{ padding: '16px', border: '1px solid #E5E7EB', color: '#1A1A1A', fontSize: '12px' }}>
          ERROR: {error}
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
    <div style={{ padding: '32px' }} className="max-w-7xl mx-auto bg-white">
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '20px', margin: '0 0 8px 0', color: colors.black, fontWeight: '500', letterSpacing: '0.02em' }}>
          POPULATION STATISTICS
        </h2>
        <p style={{ margin: 0, color: '#737373', fontSize: '12px' }}>
          ခရိုင်၊ မြို့နယ်၊ ရပ်ကွက်/ကျေးရွာအလိုက် လူဦးရေစာရင်းအင်းများကို ကြည့်ရှုပါ။
        </p>
      </div>

      {/* ─── Filter Section ────────────────────────────────── */}
      <div style={sectionCardStyle}>
        <div style={sectionTitleStyle}>
          <Search size={14} color={colors.black} /> FILTER BY LOCATION
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '24px' }}>
          {/* District */}
          <div>
            <label style={{ fontSize: '11px', fontWeight: '500', color: '#737373', display: 'block', letterSpacing: '0.02em' }}>
              ခရိုင် (DISTRICT)
            </label>
            <select value={selectedDistrict} onChange={(e) => setSelectedDistrict(e.target.value)} style={selectStyle}>
              <option value="">--- အားလုံး (All Districts) ---</option>
              {districts.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          {/* Township */}
          <div>
            <label style={{ fontSize: '11px', fontWeight: '500', color: '#737373', display: 'block', letterSpacing: '0.02em' }}>
              မြို့နယ် (TOWNSHIP)
            </label>
            <select value={selectedTownship} onChange={(e) => setSelectedTownship(e.target.value)} style={selectStyle} disabled={!selectedDistrict}>
              <option value="">--- အားလုံး (All Townships) ---</option>
              {townships.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          {/* Ward / Village */}
          <div>
            <label style={{ fontSize: '11px', fontWeight: '500', color: '#737373', display: 'block', letterSpacing: '0.02em' }}>
              ရပ်ကွက် / ကျေးရွာ / အုပ်စု (WARD / VILLAGE / GROUP)
            </label>
            <select value={selectedWard} onChange={(e) => setSelectedWard(e.target.value)} style={selectStyle} disabled={!selectedTownship}>
              <option value="">--- အားလုံး (All Wards) ---</option>
              {wards.map(w => <option key={w} value={w}>{w}</option>)}
            </select>
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
            <button onClick={() => { setSelectedDistrict(''); setSelectedTownship(''); setSelectedWard(''); }}
              style={{ fontSize: '11px', border: `1px solid ${colors.black}`, background: 'none', color: colors.black, padding: '2px 8px', cursor: 'pointer', textTransform: 'uppercase' }}>
              Clear
            </button>
          </div>
        )}
      </div>

      {/* ─── Summary Cards ─────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '24px', marginBottom: '24px' }}>
        <StatCard label="Total Population" value={totalPopulation} icon={Users} color={colors.forestGreen} />
        <StatCard label="Male" value={totalMale} icon={User} color={colors.slateGray} />
        <StatCard label="Female" value={totalFemale} icon={User} color={colors.mutedClay} />
        <StatCard label="Households" value={new Set(currentData.map(d => d.household_no).filter(Boolean)).size} icon={Home} color={colors.earthyBrown} />
      </div>

      {/* ─── Age Distribution ──────────────────────────────── */}
      <div style={sectionCardStyle}>
        <div style={sectionTitleStyle}>
          <BarChart2 size={14} color={colors.black} /> AGE DISTRIBUTION
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '24px' }}>
          <div style={{ padding: '24px', border: `1px solid ${colors.oliveGreen}`, textAlign: 'center' }}>
            <div style={{ fontSize: '10px', color: '#737373', fontWeight: '600', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Under 16</div>
            <div style={{ fontSize: '11px', color: '#737373', marginBottom: '12px' }}>အသက် ၁၆ နှစ်အောက်</div>
            <div style={{ fontSize: '32px', fontWeight: '500', color: colors.oliveGreen, fontFamily: 'var(--font-mono)' }}>{toMyanmarNum(under16)}</div>
          </div>
          <div style={{ padding: '24px', border: `1px solid ${colors.tealDusk}`, textAlign: 'center' }}>
            <div style={{ fontSize: '10px', color: '#737373', fontWeight: '600', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>16 – 60</div>
            <div style={{ fontSize: '11px', color: '#737373', marginBottom: '12px' }}>အသက် ၁၆ - ၆၀ နှစ်</div>
            <div style={{ fontSize: '32px', fontWeight: '500', color: colors.tealDusk, fontFamily: 'var(--font-mono)' }}>{toMyanmarNum(between16and60)}</div>
          </div>
          <div style={{ padding: '24px', border: `1px solid ${colors.rustSienna}`, textAlign: 'center' }}>
            <div style={{ fontSize: '10px', color: '#737373', fontWeight: '600', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Above 60</div>
            <div style={{ fontSize: '11px', color: '#737373', marginBottom: '12px' }}>အသက် ၆၀ နှစ်အထက်</div>
            <div style={{ fontSize: '32px', fontWeight: '500', color: colors.rustSienna, fontFamily: 'var(--font-mono)' }}>{toMyanmarNum(above60)}</div>
          </div>
          {unknownAge > 0 && (
            <div style={{ padding: '24px', border: `1px solid ${colors.stoneGray}`, textAlign: 'center' }}>
              <div style={{ fontSize: '10px', color: '#737373', fontWeight: '600', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Unknown</div>
              <div style={{ fontSize: '11px', color: '#737373', marginBottom: '12px' }}>အသက်မသိ</div>
              <div style={{ fontSize: '32px', fontWeight: '400', color: colors.stoneGray, fontFamily: 'var(--font-mono)' }}>{toMyanmarNum(unknownAge)}</div>
            </div>
          )}
        </div>
      </div>

      {/* ─── Breakdown Section ──────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '24px', marginBottom: '24px' }}>
        {/* ─── Religious Statistics ───────────────────────── */}
        <div style={sectionCardStyle}>
          <div style={sectionTitleStyle}>
            <MapPin size={14} color={colors.black} /> RELIGIOUS STATISTICS
          </div>
          <HorizontalBar data={religiousData} color={colors.earthyBrown} />
        </div>

        {/* ─── Nationality Statistics ────────────────────── */}
        <div style={sectionCardStyle}>
          <div style={sectionTitleStyle}>
            <Globe size={14} color={colors.black} /> NATIONALITY STATISTICS
          </div>
          <HorizontalBar data={nationalityData} color={colors.forestGreen} />
        </div>
      </div>

      {/* ─── Comprehensive Summary Tables ─────────────────────── */}
      {(() => {
        const isMale = (g) => g && (g === 'ကျား' || g === 'က');
        const isFemale = (g) => g && g === 'မ';

        const wardGroups = {};
        currentData.forEach(d => {
          const ward = d.ward_village_group || 'အခြား';
          if (!wardGroups[ward]) wardGroups[ward] = [];
          wardGroups[ward].push(d);
        });
        const wardNames = Object.keys(wardGroups).sort();

        const allReligions = [...new Set(currentData.map(d => d.religious).filter(Boolean))].sort();
        const allNationalities = [...new Set(currentData.map(d => d.nationality).filter(Boolean))].sort();

        const computeStats = (records) => {
          const male = records.filter(r => isMale(r.gender)).length;
          const female = records.filter(r => isFemale(r.gender)).length;
          const total = records.length;
          const households = new Set(records.map(r => r.household_no).filter(Boolean)).size;

          const agesWithGender = records.map(r => ({ age: calculateAge(r.date_of_birth), gender: r.gender }));

          const u16m = agesWithGender.filter(r => r.age !== null && r.age < 16 && isMale(r.gender)).length;
          const u16f = agesWithGender.filter(r => r.age !== null && r.age < 16 && isFemale(r.gender)).length;
          const b1660m = agesWithGender.filter(r => r.age !== null && r.age >= 16 && r.age <= 60 && isMale(r.gender)).length;
          const b1660f = agesWithGender.filter(r => r.age !== null && r.age >= 16 && r.age <= 60 && isFemale(r.gender)).length;
          const a60m = agesWithGender.filter(r => r.age !== null && r.age > 60 && isMale(r.gender)).length;
          const a60f = agesWithGender.filter(r => r.age !== null && r.age > 60 && isFemale(r.gender)).length;

          const relCounts = {};
          allReligions.forEach(rel => { relCounts[rel] = records.filter(r => r.religious === rel).length; });

          const natCounts = {};
          allNationalities.forEach(nat => { natCounts[nat] = records.filter(r => r.nationality === nat).length; });

          const nonLocal = records.filter(r => r.resident_status === 'ပြည်နယ်ခြားသား').length;

          return { male, female, total, households, u16m, u16f, b1660m, b1660f, a60m, a60f, relCounts, natCounts, nonLocal };
        };

        const wardStats = wardNames.map(w => ({ name: w, ...computeStats(wardGroups[w]) }));
        const totalStats = computeStats(currentData);

        const thS = { padding: '12px 8px', fontSize: '10px', fontWeight: '600', color: '#737373', borderBottom: '1px solid #E5E7EB', borderRight: '1px solid #E5E7EB', textAlign: 'center', whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: '0.05em', backgroundColor: '#FAFAFA' };
        const tdS = { padding: '10px 8px', fontSize: '12px', textAlign: 'center', borderBottom: '1px solid #E5E7EB', borderRight: '1px solid #E5E7EB', color: '#1A1A1A' };
        const tdMonoS = { ...tdS, fontFamily: 'var(--font-mono)' };
        const tdBold = { ...tdMonoS, fontWeight: '600', backgroundColor: '#FAFAFA' };

        return (
          <>
            {/* ── Table 1: Population + Age + Religious ─────── */}
            <div style={sectionCardStyle}>
              <div style={sectionTitleStyle}>SUMMARY TABLE (1) — POPULATION, AGE, RELIGION</div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #E5E7EB', minWidth: '900px' }}>
                  <thead>
                    <tr>
                      <th rowSpan={2} style={thS}>စဉ်</th>
                      <th rowSpan={2} style={thS}>ရပ်ကွက်/အုပ်စု</th>
                      <th rowSpan={2} style={thS}>အိမ်ထ</th>
                      <th colSpan={3} style={thS}>လူဦးရေပေါင်း</th>
                      <th colSpan={3} style={thS}>၁၆ နှစ်အောက်</th>
                      <th colSpan={3} style={thS}>၁၆ - ၆၀ နှစ်အကြား</th>
                      <th colSpan={3} style={thS}>၆၀ နှစ်အထက်</th>
                      {allReligions.length > 0 && <th colSpan={allReligions.length} style={thS}>ကိုးကွယ်သည့်ဘာသာ</th>}
                      <th rowSpan={2} style={thS}>ပြည်နယ်ခြားသား</th>
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
                    {wardStats.map((w, i) => (
                      <tr key={w.name} style={{ backgroundColor: '#FFFFFF' }}>
                        <td style={tdMonoS}>{toMyanmarNum(i + 1)}</td>
                        <td style={{ ...tdS, textAlign: 'left', fontWeight: '500' }}>{w.name}</td>
                        <td style={tdMonoS}>{toMyanmarNum(w.households)}</td>
                        <td style={tdMonoS}>{toMyanmarNum(w.male)}</td>
                        <td style={tdMonoS}>{toMyanmarNum(w.female)}</td>
                        <td style={{ ...tdMonoS, fontWeight: '600', color: colors.forestGreen }}>{toMyanmarNum(w.total)}</td>
                        <td style={tdMonoS}>{toMyanmarNum(w.u16m)}</td>
                        <td style={tdMonoS}>{toMyanmarNum(w.u16f)}</td>
                        <td style={tdMonoS}>{toMyanmarNum(w.u16m + w.u16f)}</td>
                        <td style={tdMonoS}>{toMyanmarNum(w.b1660m)}</td>
                        <td style={tdMonoS}>{toMyanmarNum(w.b1660f)}</td>
                        <td style={tdMonoS}>{toMyanmarNum(w.b1660m + w.b1660f)}</td>
                        <td style={tdMonoS}>{toMyanmarNum(w.a60m)}</td>
                        <td style={tdMonoS}>{toMyanmarNum(w.a60f)}</td>
                        <td style={tdMonoS}>{toMyanmarNum(w.a60m + w.a60f)}</td>
                        {allReligions.map(r => <td key={r} style={tdMonoS}>{w.relCounts[r] ? toMyanmarNum(w.relCounts[r]) : '-'}</td>)}
                        <td style={tdMonoS}>{w.nonLocal ? toMyanmarNum(w.nonLocal) : '-'}</td>
                      </tr>
                    ))}
                    {/* Total Row */}
                    <tr>
                      <td style={tdBold}></td>
                      <td style={{ ...tdS, textAlign: 'left', fontWeight: '600', backgroundColor: '#FAFAFA' }}>စုစုပေါင်း</td>
                      <td style={tdBold}>{toMyanmarNum(totalStats.households)}</td>
                      <td style={tdBold}>{toMyanmarNum(totalStats.male)}</td>
                      <td style={tdBold}>{toMyanmarNum(totalStats.female)}</td>
                      <td style={{ ...tdBold, color: colors.forestGreen }}>{toMyanmarNum(totalStats.total)}</td>
                      <td style={tdBold}>{toMyanmarNum(totalStats.u16m)}</td>
                      <td style={tdBold}>{toMyanmarNum(totalStats.u16f)}</td>
                      <td style={tdBold}>{toMyanmarNum(totalStats.u16m + totalStats.u16f)}</td>
                      <td style={tdBold}>{toMyanmarNum(totalStats.b1660m)}</td>
                      <td style={tdBold}>{toMyanmarNum(totalStats.b1660f)}</td>
                      <td style={tdBold}>{toMyanmarNum(totalStats.b1660m + totalStats.b1660f)}</td>
                      <td style={tdBold}>{toMyanmarNum(totalStats.a60m)}</td>
                      <td style={tdBold}>{toMyanmarNum(totalStats.a60f)}</td>
                      <td style={tdBold}>{toMyanmarNum(totalStats.a60m + totalStats.a60f)}</td>
                      {allReligions.map(r => <td key={r} style={tdBold}>{totalStats.relCounts[r] ? toMyanmarNum(totalStats.relCounts[r]) : '-'}</td>)}
                      <td style={tdBold}>{totalStats.nonLocal ? toMyanmarNum(totalStats.nonLocal) : '-'}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* ── Table 2: Population + Nationality ──────────── */}
            <div style={sectionCardStyle}>
              <div style={sectionTitleStyle}>SUMMARY TABLE (2) — NATIONALITY</div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #E5E7EB', minWidth: '600px' }}>
                  <thead>
                    <tr>
                      <th rowSpan={2} style={thS}>စဉ်</th>
                      <th rowSpan={2} style={thS}>ရပ်ကွက်/အုပ်စု</th>
                      <th colSpan={3} style={thS}>လူဦးရေပေါင်း</th>
                      {allNationalities.length > 0 && <th colSpan={allNationalities.length} style={thS}>လူမျိုးအလိုက်</th>}
                      <th rowSpan={2} style={thS}>ပြည်နယ်ခြားသား</th>
                    </tr>
                    <tr>
                      <th style={thS}>ကျား</th><th style={thS}>မ</th><th style={thS}>ပေါင်း</th>
                      {allNationalities.map(n => <th key={n} style={thS}>{n}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {wardStats.map((w, i) => (
                      <tr key={w.name} style={{ backgroundColor: '#FFFFFF' }}>
                        <td style={tdMonoS}>{toMyanmarNum(i + 1)}</td>
                        <td style={{ ...tdS, textAlign: 'left', fontWeight: '500' }}>{w.name}</td>
                        <td style={tdMonoS}>{toMyanmarNum(w.male)}</td>
                        <td style={tdMonoS}>{toMyanmarNum(w.female)}</td>
                        <td style={{ ...tdMonoS, fontWeight: '600', color: colors.forestGreen }}>{toMyanmarNum(w.total)}</td>
                        {allNationalities.map(n => <td key={n} style={tdMonoS}>{w.natCounts[n] ? toMyanmarNum(w.natCounts[n]) : '-'}</td>)}
                        <td style={tdMonoS}>{w.nonLocal ? toMyanmarNum(w.nonLocal) : '-'}</td>
                      </tr>
                    ))}
                    {/* Total Row */}
                    <tr>
                      <td style={tdBold}></td>
                      <td style={{ ...tdS, textAlign: 'left', fontWeight: '600', backgroundColor: '#FAFAFA' }}>စုစုပေါင်း</td>
                      <td style={tdBold}>{toMyanmarNum(totalStats.male)}</td>
                      <td style={tdBold}>{toMyanmarNum(totalStats.female)}</td>
                      <td style={{ ...tdBold, color: colors.forestGreen }}>{toMyanmarNum(totalStats.total)}</td>
                      {allNationalities.map(n => <td key={n} style={tdBold}>{totalStats.natCounts[n] ? toMyanmarNum(totalStats.natCounts[n]) : '-'}</td>)}
                      <td style={tdBold}>{totalStats.nonLocal ? toMyanmarNum(totalStats.nonLocal) : '-'}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </>
        );
      })()}
    </div>
  );
};

export default PopulationStatistics;
