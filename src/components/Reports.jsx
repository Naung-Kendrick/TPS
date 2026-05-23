import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { cacheGet, cacheSet } from '../lib/offlineCache';
import { SkeletonTable, SkeletonBar } from './Skeleton';
import { ChevronRight, Search, Map as MapIcon, MapPin, Home, Users, User, ArrowLeft, Loader2, AlertCircle, Printer, FileSpreadsheet, Pencil, Trash2, Check, X, Download } from 'lucide-react';
import EmptyState from './EmptyState';
import { exportHouseholdExcel, printHouseholdPdf } from '../lib/householdPrint';
import { deepEnsureUnicode } from './CsvUploader';
import { buildExportFilename } from '../lib/exportFilename';

const Reports = () => {
  const [level, setLevel] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');

  const [path, setPath] = useState({
    district: null,
    township: null,
    locationType: null, // 'ward' | 'group' | null
    ward: null,
    group: null,
    village: null,
    headName: null,
    householdNo: null
  });

  const [dataList, setDataList] = useState([]); // Stores items for Levels 1 to 5
  const [familyMembers, setFamilyMembers] = useState([]); // Stores items for Level 6

  // Export All JSON state
  const [exportingJson, setExportingJson] = useState(false);

  // Edit / delete state
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});

  const [saving, setSaving] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const tableScrollRef = useRef(null);
  const scroll = (dir) => {
    if (tableScrollRef.current) tableScrollRef.current.scrollBy({ left: dir * 200, behavior: 'smooth' });
  };

  // Trigger data fetching whenever level or path changes
  useEffect(() => {
    fetchData();
  }, [level, path.district, path.township, path.locationType, path.ward, path.group, path.village, path.householdNo]);

  // Real-time subscription for level 6 (family members)
  useEffect(() => {
    if (level !== 6 || !path.householdNo) return;

    const relationshipOrder = { 'ဦးစီး': 1, 'ဇနီး': 2, 'ခင်ပွန်း': 2, 'သား': 3, 'သမီး': 3 };
    const resort = (arr) => [...arr].sort((a, b) =>
      (relationshipOrder[a.household_relationship] || 99) - (relationshipOrder[b.household_relationship] || 99)
    );

    const channel = supabase
      .channel(`household-${path.householdNo}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'households',
        filter: `household_no=eq.${path.householdNo}`,
      }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setFamilyMembers(prev => resort([...prev, payload.new]));
        } else if (payload.eventType === 'UPDATE') {
          setFamilyMembers(prev => resort(prev.map(m => m.id === payload.new.id ? payload.new : m)));
        } else if (payload.eventType === 'DELETE') {
          setFamilyMembers(prev => prev.filter(m => m.id !== payload.old.id));
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [level, path.householdNo]);

  const fetchData = async () => {
    setError(null);
    setSearch('');

    // Cache key for this navigation state (v3 = normalized Myanmar text)
    const cacheKey = `reports_v3_l${level}_${path.district||''}_${path.township||''}_${path.locationType||''}_${path.ward||''}_${path.group||''}_${path.village||''}_${path.householdNo||''}`;

    // Serve cached data immediately (stale-while-revalidate)
    const cached = await cacheGet(cacheKey);
    if (cached) {
      if (level === 6) setFamilyMembers(cached);
      else setDataList(cached);
      setLoading(false);
    } else {
      setLoading(true);
    }

    try {
      if (level === 1) {
        // Districts
        const { data, error } = await supabase.rpc('report_districts');
        if (error) throw error;
        const list = (data || []).map(d => ({ id: d.district, name: d.district }));
        setDataList(list);
        cacheSet(cacheKey, list);
      } 
      else if (level === 2) {
        // Townships
        const { data, error } = await supabase.rpc('report_townships', { p_district: path.district });
        if (error) throw error;
        const list = (data || []).map(d => ({ id: d.township, name: d.township }));
        setDataList(list);
        cacheSet(cacheKey, list);
      }
      else if (level === 3) {
        // After Township, show BOTH Wards AND Groups as separate options
        // Fetch wards
        const { data: wardsData, error: wardsError } = await supabase.rpc('report_wards', { p_township: path.township });
        if (wardsError) throw wardsError;
        
        // Fetch groups
        const { data: groupsData, error: groupsError } = await supabase.rpc('report_groups_by_township', { p_township: path.township });
        if (groupsError) throw groupsError;
        
        // Combine into location type options
        const list = [
          ...(wardsData || []).map(d => ({ id: `ward:${d.ward}`, name: d.ward, locationType: 'ward' })),
          ...(groupsData || []).map(d => ({ id: `group:${d.group_name}`, name: d.group_name, locationType: 'group' }))
        ];
        setDataList(list);
        cacheSet(cacheKey, list);
      }
      else if (level === 4) {
        // If user selected a Ward: show household heads directly
        if (path.locationType === 'ward') {
          const { data, error } = await supabase
            .from('households')
            .select('id, name, household_no, gender, occupation, date_of_birth')
            .ilike('ward_village_group', '%' + path.ward.trim() + '%')
            .ilike('household_relationship', '%ဦးစီး%');
          if (error) throw error;
          console.log('Ward query:', path.ward, 'Results:', data?.length || 0);
          setDataList(data || []);
          cacheSet(cacheKey, data || []);
        }
        // If user selected a Group: show villages in this group
        else if (path.locationType === 'group') {
          console.log('Fetching villages for group:', path.group);
          const { data, error } = await supabase.rpc('report_village_only', { p_group: path.group.trim() });
          if (error) throw error;
          console.log('Group villages result:', data?.length || 0, 'villages');
          const list = (data || []).map(d => ({ id: d.village, name: d.village }));
          setDataList(list);
          cacheSet(cacheKey, list);
        }
      }
      else if (level === 5 && path.locationType === 'group' && path.village) {
        // Only reachable if locationType is 'group' and village is selected
        // Household heads under this village
        console.log('Fetching household heads for village:', path.village);
        
        // First try: search for village name anywhere in ward_village_group
        let { data, error } = await supabase
          .from('households')
          .select('id, name, household_no, gender, occupation, date_of_birth')
          .ilike('ward_village_group', '%' + path.village.trim() + '%')
          .ilike('household_relationship', '%ဦးစီး%');
          
        if (error) throw error;
        console.log('Village household heads (pattern search):', data?.length || 0);
        
        // If no results, try exact match
        if (!data || data.length === 0) {
          console.log('Trying exact match for village:', path.village);
          const result2 = await supabase
            .from('households')
            .select('id, name, household_no, gender, occupation, date_of_birth')
            .eq('ward_village_group', path.village.trim())
            .ilike('household_relationship', '%ဦးစီး%');
          data = result2.data;
          console.log('Village household heads (exact match):', data?.length || 0);
        }
        
        setDataList(data || []);
        cacheSet(cacheKey, data || []);
      }
      else if (level === 6) {
        // Family members
        const { data, error } = await supabase
          .from('households')
          .select('*')
          .eq('household_no', path.householdNo);
        if (error) throw error;
        
        const relationshipOrder = { 'ဦးစီး': 1, 'ဇနီး': 2, 'ခင်ပွန်း': 2, 'သား': 3, 'သမီး': 3 };
        const sortedData = [...(data || [])].sort((a, b) => {
          const orderA = relationshipOrder[a.household_relationship] || 99;
          const orderB = relationshipOrder[b.household_relationship] || 99;
          return orderA - orderB;
        });
        setFamilyMembers(sortedData);
        cacheSet(cacheKey, sortedData);
      }
    } catch (err) {
      console.error(err);
      if (!cached) setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleNavigate = (newLevel, payload) => {
    setPath(prev => {
      const newPath = { ...prev, ...payload };
      
      // Strict hierarchy reset rules:
      // When changing district: reset everything below
      if (newLevel <= 2) {
        newPath.township = null;
        newPath.locationType = null;
        newPath.ward = null;
        newPath.group = null;
        newPath.village = null;
        newPath.householdNo = null;
        newPath.headName = null;
      }
      
      // When changing township: reset location selection and everything below
      if (newLevel <= 3) {
        newPath.locationType = null;
        newPath.ward = null;
        newPath.group = null;
        newPath.village = null;
        newPath.householdNo = null;
        newPath.headName = null;
      }
      
      // When selecting ward vs group (mutually exclusive):
      // Clear the other location type completely
      if (newLevel <= 4) {
        if (newPath.locationType === 'ward') {
          // Ward selected: clear all group/village related fields
          newPath.group = null;
          newPath.village = null;
        } else if (newPath.locationType === 'group') {
          // Group selected: clear ward
          newPath.ward = null;
        }
        newPath.householdNo = null;
        newPath.headName = null;
      }
      
      // When changing village (only applies to group path): reset household
      if (newLevel <= 5 && newPath.locationType === 'group') {
        newPath.householdNo = null;
        newPath.headName = null;
      }
      
      // When navigating BACK from level 6 (family members): reset household
      if (newLevel < 6) {
        newPath.householdNo = null;
        newPath.headName = null;
      }
      
      return newPath;
    });
    setLevel(newLevel);
  };

  const jumpToLevel = (targetLevel) => {
    if (targetLevel >= level) return;
    const newPath = { ...path };
    
    // Reset states based on target level
    if (targetLevel < 6) { newPath.householdNo = null; newPath.headName = null; }
    if (targetLevel < 5 && newPath.locationType === 'group') newPath.village = null;
    if (targetLevel < 4) {
      // Jumping back to township level or above: clear location selection entirely
      // This allows user to choose different path (ward vs group)
      newPath.locationType = null;
      newPath.ward = null;
      newPath.group = null;
      newPath.village = null;
      newPath.householdNo = null;
      newPath.headName = null;
    }
    if (targetLevel < 3) newPath.township = null;
    if (targetLevel < 2) newPath.district = null;
    
    setPath(newPath);
    setLevel(targetLevel);
  };

  const goBack = () => {
    if (level > 1) jumpToLevel(level - 1);
  };

  // ── JSON EXPORT helpers ───────────────────────────────────────────────────────────
  const downloadJson = (data, filename) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const buildNestedHousehold = (householdNo, members) => {
    const first = members[0] || {};
    return {
      household_id: householdNo,
      location: {
        house_no: first.house_no || '',
        ward_village: first.ward_village_group || '',
        township: first.township || '',
        district: first.district || '',
      },
      members: members.map(m => ({
        name: m.name || '',
        dob: m.date_of_birth || '',
        gender: m.gender || '',
        relationship: m.household_relationship || '',
        fathers_name: m.fathers_name || '',
        mothers_name: m.mothers_name || '',
        occupation: m.occupation || '',
        nationality: m.nationality || '',
        religious: m.religious || '',
        resident_status: m.resident_status || '',
        previous_id_no: m.previous_id_no || '',
        taang_land_id_no: m.taang_land_id_no || '',
        submission_date: m.submission_date || (m.created_at ? m.created_at.split('T')[0] : ''),
      }))
    };
  };

  const exportHouseholdJson = () => {
    if (!familyMembers.length) return;
    const nested = deepEnsureUnicode(buildNestedHousehold(path.householdNo, familyMembers));
    const first = familyMembers[0] || {};
    const head = familyMembers.find(m => m.household_relationship === 'ဦးစီး') || first;
    downloadJson(nested, buildExportFilename({
      type: 'household',
      district: first.district,
      township: first.township,
      ward: first.ward_village_group,
      householdNo: path.householdNo,
      headName: head.name,
      ext: 'json',
    }));
  };

  const exportAllJson = async () => {
    setExportingJson(true);
    try {
      let query = supabase
        .from('households')
        .select('*')
        .order('household_no', { ascending: true })
        .order('id', { ascending: true });

      if (path.district) query = query.eq('district', path.district);
      if (path.township) query = query.eq('township', path.township);
      if (path.village)  query = query.eq('ward_village_group', path.village);

      const { data, error } = await query;
      if (error) throw error;

      const householdsMap = new Map();
      const order = [];
      for (const row of (data || [])) {
        const hn = row.household_no || 'UNKNOWN';
        if (!householdsMap.has(hn)) {
          householdsMap.set(hn, []);
          order.push(hn);
        }
        householdsMap.get(hn).push(row);
      }
      const nested = deepEnsureUnicode(order.map(hn => buildNestedHousehold(hn, householdsMap.get(hn))));

      const sanitize = (str) => String(str || '').trim().replace(/[/\:*?"<>|]/g, '').replace(/\s+/g, '_') || null;
      const today = new Date().toISOString().split('T')[0];
      const parts = [
        sanitize(path.district),
        sanitize(path.township),
        sanitize(path.village),
      ].filter(Boolean);
      const prefix = parts.length ? parts.join('_') : 'TPS_FullExport';
      downloadJson(nested, `${prefix}_${today}.json`);
    } catch (err) {
      alert('Export failed: ' + err.message);
    } finally {
      setExportingJson(false);
    }
  };

  // ── EDIT handlers ──────────────────────────────────────────────────────────
  const startEdit = (member) => {
    setEditingId(member.id);
    setEditForm({ ...member });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const saveEdit = async () => {
    setSaving(true);
    try {
      const { id, created_at, ...fields } = editForm;
      const { error } = await supabase
        .from('households')
        .update(fields)
        .eq('id', editingId);
      if (error) throw error;
      setFamilyMembers(prev =>
        prev.map(m => m.id === editingId ? { ...m, ...fields } : m)
      );
      setEditingId(null);
      setEditForm({});
    } catch (err) {
      alert('Save failed: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // ── DELETE handlers ─────────────────────────────────────────────────────────
  const confirmDelete = (id) => setDeleteConfirmId(id);
  const cancelDelete = () => setDeleteConfirmId(null);

  const doDelete = async () => {
    setDeleting(true);
    try {
      const { error } = await supabase
        .from('households')
        .delete()
        .eq('id', deleteConfirmId);
      if (error) throw error;
      setFamilyMembers(prev => prev.filter(m => m.id !== deleteConfirmId));
      setDeleteConfirmId(null);
    } catch (err) {
      alert('Delete failed: ' + err.message);
    } finally {
      setDeleting(false);
    }
  };

  const filteredData = dataList.filter(item => {
    const matches = item.name?.toLowerCase().includes(search.toLowerCase()) || 
                    item.household_no?.toLowerCase().includes(search.toLowerCase());
    return matches;
  });
  
  // Debug logging
  useEffect(() => {
    console.log('Level:', level, 'dataList length:', dataList.length, 'filteredData length:', filteredData.length, 'search:', search);
  }, [level, dataList, filteredData, search]);

  const thStyle = {
    padding: '12px 16px',
    textAlign: 'left',
    fontSize: '10px',
    fontWeight: '600',
    color: '#737373',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    borderBottom: '1px solid #E5E7EB',
    backgroundColor: '#FAFAFA',
  };

  const tdStyle = {
    padding: '12px 16px',
    fontSize: '12px',
    color: '#1A1A1A',
    borderBottom: '1px solid #E5E7EB',
  };

  return (
    <div className="px-4 py-5 sm:p-8 xl:p-10 max-w-7xl xl:max-w-[1440px] mx-auto min-h-screen bg-white">
      
      {/* HEADER & BREADCRUMBS */}
      <div className="mb-5 sm:mb-8">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
          <div>
            <h2 style={{ fontSize: '20px', margin: '0 0 8px 0', color: '#1A1A1A', fontWeight: '500', letterSpacing: '0.02em' }}>
              CENTRAL DATABASE
            </h2>
            <p style={{ margin: 0, color: '#737373', fontSize: '12px' }}>
              Browse and manage household records and family rosters across regions.
            </p>
          </div>
          <button
            type="button"
            onClick={exportAllJson}
            disabled={exportingJson}
            className="flex items-center justify-center gap-2 border border-gray-300 text-gray-600 hover:border-gray-900 hover:text-gray-900 px-3 py-2 text-xs uppercase font-medium transition-colors disabled:opacity-50 w-full sm:w-auto"
            style={{ marginTop: '4px' }}
          >
            {exportingJson ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
            {exportingJson ? 'Exporting...' : 'Export All JSON'}
          </button>
        </div>

        {/* Breadcrumb — scrollable horizontally on mobile */}
        <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500 uppercase overflow-x-auto pb-1 scrollbar-none whitespace-nowrap">        
          <button onClick={() => jumpToLevel(1)} className={`flex items-center gap-1 hover:text-gray-900 transition-colors ${level === 1 ? 'text-gray-900 font-bold' : ''}`}>
            <MapIcon size={14} /> Districts
          </button>
          
          {path.district && (
            <>
              <ChevronRight size={14} />
              <button onClick={() => jumpToLevel(2)} className={`flex items-center gap-1 hover:text-gray-900 transition-colors ${level === 2 ? 'text-gray-900 font-bold' : ''}`}>
                <MapPin size={14} /> {path.district}
              </button>
            </>
          )}

          {path.township && (
            <>
              <ChevronRight size={14} />
              <button onClick={() => jumpToLevel(2)} className={`flex items-center gap-1 hover:text-gray-900 transition-colors ${level === 2 ? 'text-gray-900 font-bold' : ''}`}>
                <Home size={14} /> {path.township}
              </button>
            </>
          )}

          {path.locationType && (
            <>
              <ChevronRight size={14} />
              <button onClick={() => jumpToLevel(3)} className={`flex items-center gap-1 hover:text-gray-900 transition-colors ${level === 3 ? 'text-gray-900 font-bold' : ''}`}>
                {path.locationType === 'ward' ? <Home size={14} /> : <Users size={14} />}
                {path.locationType === 'ward' ? path.ward : path.group}
              </button>
            </>
          )}

          {path.village && path.locationType === 'group' && (
            <>
              <ChevronRight size={14} />
              <button onClick={() => jumpToLevel(4)} className={`flex items-center gap-1 hover:text-gray-900 transition-colors ${level === 4 ? 'text-gray-900 font-bold' : ''}`}>
                <Home size={14} /> {path.village}
              </button>
            </>
          )}

          {path.householdNo && (
            <>
              <ChevronRight size={14} />
              <span className="flex items-center gap-1 text-gray-900 font-bold">
                <User size={14} /> {path.headName} ({path.householdNo})
              </span>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-8">
          <EmptyState
            type={!navigator.onLine ? 'offline' : 'error'}
            message={!navigator.onLine ? 'The device is offline. Cached data may be shown.' : 'Could not load records from the database.'}
            detail={error}
            action={{ label: 'Retry', onClick: fetchData }}
          />
        </div>
      )}

      {/* CONTROLS */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 mb-4">
        {level > 1 ? (
          <button onClick={goBack} className="flex items-center justify-center gap-2 px-4 py-2 bg-white border border-gray-900 text-gray-900 font-medium text-xs uppercase w-full sm:w-auto">
            <ArrowLeft size={13} /> Back
          </button>
        ) : <div className="hidden sm:block" />}

        {level <= 4 && (
          <div className="relative w-full sm:w-80">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
              <Search size={13} />
            </div>
            <input
              type="text"
              placeholder={`Search ${level === 1 ? 'districts' : level === 2 ? 'townships' : level === 3 ? 'locations' : level === 4 && path.locationType === 'ward' ? 'household heads' : 'villages'}...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-none focus:outline-none focus:border-gray-900 transition-colors text-xs"
            />
          </div>
        )}
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="border border-gray-200 bg-white min-h-[300px]">
        {loading ? (
          <div style={{ padding: '24px' }}>
            <SkeletonTable rows={level === 4 || level === 5 || level === 6 ? 8 : 6} cols={level === 4 || level === 5 || level === 6 ? 5 : 2} />
          </div>
        ) : (
          <>
            {/* LEVELS 1, 2, 3: CARDS GRID */}
            {level <= 3 && (
              <div className="p-3 sm:p-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 xl:gap-4 bg-white min-h-[300px]">
                {filteredData.length === 0 ? (
                  <div className="col-span-full">
                    <EmptyState type="no-results" message={search ? `No results for "${search}".` : 'No records available at this level.'} compact />
                  </div>
                ) : (
                  filteredData.map((item, idx) => (
                    <div 
                      key={idx} 
                      onClick={() => {
                        if (level === 1) handleNavigate(2, { district: item.name });
                        if (level === 2) handleNavigate(3, { township: item.name });
                        if (level === 3) {
                          // Level 3: handle selection of ward or group
                          if (item.locationType === 'ward') {
                            handleNavigate(4, { locationType: 'ward', ward: item.name });
                          } else if (item.locationType === 'group') {
                            handleNavigate(4, { locationType: 'group', group: item.name });
                          }
                        }
                      }}
                      className="bg-white p-4 border border-gray-200 hover:border-gray-900 active:bg-gray-50 cursor-pointer transition-[border-color] duration-100 flex items-center justify-between group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="text-gray-500 group-hover:text-gray-900 transition-colors">
                          {level === 1 && <MapIcon size={15} />}
                          {level === 2 && <MapPin size={15} />}
                          {level === 3 && item.locationType === 'ward' && <Home size={15} />}
                          {level === 3 && item.locationType === 'group' && <Users size={15} />}
                        </div>
                        <span className="font-medium text-gray-900 text-xs leading-snug">{item.name}</span>
                      </div>
                      <ChevronRight size={13} className="text-gray-300 group-hover:text-gray-900 transition-colors flex-shrink-0" />
                    </div>
                  ))
                )}
              </div>
            )}

            {/* LEVEL 4: WARD HOUSEHOLD HEADS or GROUP VILLAGES */}
            {level === 4 && (
              path.locationType === 'ward' ? (
                // Ward path: show household heads — always table
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr>
                        <th style={thStyle}>Household Head (ဦးစီး)</th>
                        <th style={thStyle}>Household No.</th>
                        <th style={thStyle}>Gender</th>
                        <th style={thStyle}>Occupation</th>
                        <th style={{ ...thStyle, textAlign: 'right' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredData.length === 0 ? (
                        <tr><td colSpan={5}><EmptyState type="no-results" message={search ? `No household heads match "${search}".` : 'No household heads found in this ward.'} compact /></td></tr>
                      ) : (
                        filteredData.map(head => (
                          <tr key={head.id} className="hover:bg-gray-50 transition-colors">
                            <td style={tdStyle} className="font-medium">{head.name}</td>
                            <td style={{ ...tdStyle, fontFamily: 'monospace' }}>{head.household_no}</td>
                            <td style={tdStyle}>{head.gender || '—'}</td>
                            <td style={tdStyle}>{head.occupation || '-'}</td>
                            <td style={{ ...tdStyle, textAlign: 'right' }}>
                              <button
                                onClick={() => handleNavigate(6, { headName: head.name, householdNo: head.household_no })}
                                className="inline-flex items-center gap-1 bg-white border border-gray-900 text-gray-900 px-3 py-1 text-xs font-medium uppercase"
                              >
                                View Family <ChevronRight size={13} />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              ) : (
                // Group path: show villages as cards
                <div className="p-3 sm:p-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 xl:gap-4 bg-white min-h-[300px]">
                  {filteredData.length === 0 ? (
                    <div className="col-span-full">
                      <EmptyState type="no-results" message={search ? `No results for "${search}".` : 'No villages found in this group.'} compact />
                    </div>
                  ) : (
                    filteredData.map((item, idx) => (
                      <div 
                        key={idx} 
                        onClick={() => handleNavigate(5, { village: item.name })}
                        className="bg-white p-4 border border-gray-200 hover:border-gray-900 active:bg-gray-50 cursor-pointer transition-[border-color] duration-100 flex items-center justify-between group"
                      >
                        <div className="flex items-center gap-3">
                          <Home size={15} className="text-gray-500 group-hover:text-gray-900 transition-colors" />
                          <span className="font-medium text-gray-900 text-xs leading-snug">{item.name}</span>
                        </div>
                        <ChevronRight size={13} className="text-gray-300 group-hover:text-gray-900 transition-colors flex-shrink-0" />
                      </div>
                    ))
                  )}
                </div>
              )
            )}

            {/* LEVEL 5: VILLAGE HOUSEHOLD HEADS (group path only) */}
            {level === 5 && path.locationType === 'group' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr>
                      <th style={thStyle}>Household Head (ဦးစီး)</th>
                      <th style={thStyle}>Household No.</th>
                      <th style={thStyle}>Gender</th>
                      <th style={thStyle}>Occupation</th>
                      <th style={{ ...thStyle, textAlign: 'right' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredData.length === 0 ? (
                      <tr><td colSpan={5}><EmptyState type="no-results" message={search ? `No household heads match "${search}".` : 'No household heads found in this village.'} compact /></td></tr>
                    ) : (
                      filteredData.map(head => (
                        <tr key={head.id} className="hover:bg-gray-50 transition-colors">
                          <td style={tdStyle} className="font-medium">{head.name}</td>
                          <td style={{ ...tdStyle, fontFamily: 'monospace' }}>{head.household_no}</td>
                          <td style={tdStyle}>{head.gender || '—'}</td>
                          <td style={tdStyle}>{head.occupation || '-'}</td>
                          <td style={{ ...tdStyle, textAlign: 'right' }}>
                            <button
                              onClick={() => handleNavigate(6, { headName: head.name, householdNo: head.household_no })}
                              className="inline-flex items-center gap-1 bg-white border border-gray-900 text-gray-900 px-3 py-1 text-xs font-medium uppercase"
                            >
                              View Family <ChevronRight size={13} />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* LEVEL 6: FAMILY MEMBERS TABLE (for both ward and group/village paths) */}
            {level === 6 && (
              <div>
                {/* Delete confirmation modal */}
                {deleteConfirmId && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                    <div className="bg-white border border-gray-200 p-6 w-80 shadow-lg">
                      <p className="text-sm font-semibold text-gray-900 mb-2">Delete Member?</p>
                      <p className="text-xs text-gray-500 mb-6">This will permanently remove this record from the database. This action cannot be undone.</p>
                      <div className="flex gap-3 justify-end">
                        <button onClick={cancelDelete} disabled={deleting} className="px-4 py-2 text-xs border border-gray-900 text-gray-900">
                          Cancel
                        </button>
                        <button onClick={doDelete} disabled={deleting} className="px-4 py-2 text-xs bg-red-600 text-white hover:bg-red-700 transition-colors flex items-center gap-2">
                          {deleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                          {deleting ? 'Deleting...' : 'Delete'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex flex-wrap items-center justify-between gap-1">
                  <h3 className="font-semibold text-gray-900 text-xs uppercase tracking-wide">Family Roster: {path.householdNo}</h3>
                  <span className="text-[10px] text-gray-400 uppercase font-mono">{familyMembers.length} member{familyMembers.length !== 1 ? 's' : ''}</span>
                </div>

                <style>{`
                  .family-table-scroll::-webkit-scrollbar { height: 12px; background: #F3F4F6; }
                  .family-table-scroll::-webkit-scrollbar-track { background: #F3F4F6; border-radius: 999px; margin: 0 4px; }
                  .family-table-scroll::-webkit-scrollbar-thumb { background: #C4C4C4; border-radius: 999px; border: 2px solid #F3F4F6; }
                  .family-table-scroll::-webkit-scrollbar-thumb:hover { background: #9CA3AF; }
                  .family-table-scroll { scrollbar-width: auto; scrollbar-color: #C4C4C4 #F3F4F6; }
                `}</style>
                <div style={{ position: 'relative' }}>
                  <div ref={tableScrollRef} className="family-table-scroll" style={{ overflowX: 'auto', scrollBehavior: 'smooth', paddingBottom: '4px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', tableLayout: 'auto' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#FAFAFA' }}>
                        {['No.','Name','Date of Birth','Gender',"Father's Name","Mother's Name",'Relationship','Occupation','Previous ID No.',"Ta'ang Land ID No.",'Nationality','Resident Status','Religious','Submission Date',''].map((h, i) => (
                          <th key={i} style={{ padding: '8px 6px', fontSize: '9.5px', fontWeight: 600, color: '#737373', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid #E5E7EB', whiteSpace: 'nowrap', textAlign: i === 14 ? 'center' : 'left' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {familyMembers.length === 0 ? (
                        <tr><td colSpan={15}><EmptyState type="no-results" title="No Members Found" message="No family members are registered under this household number." compact /></td></tr>
                      ) : (
                        familyMembers.map((member, idx) => {
                          const isEditing = editingId === member.id;
                          const inStyle = { width: '100%', padding: '2px 4px', fontSize: '11px', border: '1px solid #93C5FD', outline: 'none', background: '#EFF6FF', minWidth: '70px' };
                          const cell = (key, extraStyle = {}) => isEditing
                            ? <input value={editForm[key] || ''} onChange={e => setEditForm(f => ({ ...f, [key]: e.target.value }))} style={{ ...inStyle, ...extraStyle }} />
                            : (member[key] || '—');
                          return (
                            <tr key={member.id} style={{ borderBottom: '1px solid #F3F4F6', background: isEditing ? '#F0F9FF' : undefined }}>
                              <td style={{ padding: '7px 6px', color: '#9CA3AF', fontWeight: 600, whiteSpace: 'nowrap' }}>{idx + 1}</td>
                              <td style={{ padding: '7px 6px', fontWeight: isEditing ? 400 : 600, whiteSpace: isEditing ? 'normal' : 'nowrap' }}>
                                {isEditing
                                  ? <input value={editForm.name || ''} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} style={{ ...inStyle, minWidth: '100px' }} />
                                  : <>{member.name}{member.household_relationship === 'ဦးစီး' && <span style={{ marginLeft: '4px', border: '1px solid #1A1A1A', padding: '0 3px', fontSize: '8px', fontWeight: 700 }}>HEAD</span>}</>}
                              </td>
                              <td style={{ padding: '7px 6px', whiteSpace: isEditing ? 'normal' : 'nowrap' }}>{cell('date_of_birth')}</td>
                              <td style={{ padding: '7px 6px', whiteSpace: isEditing ? 'normal' : 'nowrap' }}>{cell('gender')}</td>
                              <td style={{ padding: '7px 6px', whiteSpace: isEditing ? 'normal' : 'nowrap' }}>{cell('fathers_name')}</td>
                              <td style={{ padding: '7px 6px', whiteSpace: isEditing ? 'normal' : 'nowrap' }}>{cell('mothers_name')}</td>
                              <td style={{ padding: '7px 6px', whiteSpace: isEditing ? 'normal' : 'nowrap' }}>{cell('household_relationship')}</td>
                              <td style={{ padding: '7px 6px', whiteSpace: isEditing ? 'normal' : 'nowrap' }}>{cell('occupation')}</td>
                              <td style={{ padding: '7px 6px', whiteSpace: isEditing ? 'normal' : 'nowrap' }}>{cell('previous_id_no')}</td>
                              <td style={{ padding: '7px 6px', whiteSpace: isEditing ? 'normal' : 'nowrap' }}>{cell('taang_land_id_no')}</td>
                              <td style={{ padding: '7px 6px', whiteSpace: isEditing ? 'normal' : 'nowrap' }}>{cell('nationality')}</td>
                              <td style={{ padding: '7px 6px', whiteSpace: isEditing ? 'normal' : 'nowrap' }}>{cell('resident_status')}</td>
                              <td style={{ padding: '7px 6px', whiteSpace: isEditing ? 'normal' : 'nowrap' }}>{cell('religious')}</td>
                              <td style={{ padding: '7px 6px', whiteSpace: isEditing ? 'normal' : 'nowrap' }}>
                                {isEditing
                                  ? <input value={editForm.submission_date || ''} onChange={e => setEditForm(f => ({ ...f, submission_date: e.target.value }))} style={inStyle} />
                                  : (member.submission_date || (member.created_at ? member.created_at.split('T')[0] : '—'))}
                              </td>
                              <td style={{ padding: '7px 6px', whiteSpace: 'nowrap', textAlign: 'center' }}>
                                {isEditing ? (
                                  <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                                    <button onClick={saveEdit} disabled={saving} style={{ padding: '3px 8px', border: '1px solid #1A1A1A', background: '#1A1A1A', color: '#fff', cursor: 'pointer', fontSize: '10px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                      {saving ? <Loader2 size={9} className="animate-spin" /> : <Check size={9} />} Save
                                    </button>
                                    <button onClick={cancelEdit} style={{ padding: '3px 8px', border: '1px solid #D1D5DB', background: '#fff', cursor: 'pointer', fontSize: '10px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                      <X size={9} /> Cancel
                                    </button>
                                  </div>
                                ) : (
                                  <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                                    <button onClick={() => startEdit(member)} title="Edit" style={{ padding: '3px 6px', border: '1px solid #D1D5DB', background: '#fff', cursor: 'pointer', color: '#6B7280', fontSize: '10px' }}
                                      onMouseEnter={e => { e.currentTarget.style.borderColor = '#1A1A1A'; e.currentTarget.style.color = '#1A1A1A'; }}
                                      onMouseLeave={e => { e.currentTarget.style.borderColor = '#D1D5DB'; e.currentTarget.style.color = '#6B7280'; }}>
                                      <Pencil size={10} />
                                    </button>
                                    <button onClick={() => confirmDelete(member.id)} title="Delete" style={{ padding: '3px 6px', border: '1px solid #D1D5DB', background: '#fff', cursor: 'pointer', color: '#9CA3AF', fontSize: '10px' }}
                                      onMouseEnter={e => { e.currentTarget.style.borderColor = '#EF4444'; e.currentTarget.style.color = '#EF4444'; }}
                                      onMouseLeave={e => { e.currentTarget.style.borderColor = '#D1D5DB'; e.currentTarget.style.color = '#9CA3AF'; }}>
                                      <Trash2 size={10} />
                                    </button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                  </div>{/* end ref scroll div */}
                </div>{/* end relative wrapper */}

                {familyMembers.length > 0 && (
                  <div className="px-4 py-3 bg-white border-t border-gray-200 flex flex-col sm:flex-row sm:flex-wrap sm:items-center sm:justify-end gap-2">
                    <span className="text-[11px] text-gray-400 uppercase tracking-wide sm:mr-auto">Print / Export</span>
                    <div className="grid grid-cols-3 sm:flex sm:flex-row gap-2">
                      <button
                        type="button"
                        onClick={() => printHouseholdPdf(path.householdNo, familyMembers)}
                        className="flex items-center justify-center gap-1.5 bg-gray-900 hover:bg-white hover:text-gray-900 hover:border-gray-900 border border-gray-900 text-white px-3 py-2 font-medium transition-colors text-xs uppercase"
                      >
                        <Printer size={13} />
                        <span className="hidden sm:inline">Print PDF</span>
                        <span className="sm:hidden">Print</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => exportHouseholdExcel(path.householdNo, familyMembers)}
                        className="flex items-center justify-center gap-1.5 bg-white border border-gray-900 text-gray-900 px-3 py-2 font-medium text-xs uppercase"
                      >
                        <FileSpreadsheet size={13} />
                        <span className="hidden sm:inline">Export Excel</span>
                        <span className="sm:hidden">Excel</span>
                      </button>
                      <button
                        type="button"
                        onClick={exportHouseholdJson}
                        className="flex items-center justify-center gap-1.5 bg-white border border-gray-900 text-gray-900 px-3 py-2 font-medium text-xs uppercase"
                      >
                        <Download size={13} />
                        <span className="hidden sm:inline">Export JSON</span>
                        <span className="sm:hidden">JSON</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Reports;
