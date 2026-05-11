import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { ChevronRight, Search, Map as MapIcon, MapPin, Home, Users, User, ArrowLeft, Loader2, AlertCircle, Printer, FileSpreadsheet, Pencil, Trash2, Check, X, Download } from 'lucide-react';
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
    village: null,
    headName: null,
    householdNo: null
  });

  const [dataList, setDataList] = useState([]); // Stores items for Levels 1 to 4
  const [familyMembers, setFamilyMembers] = useState([]); // Stores items for Level 5

  // Export All JSON state
  const [exportingJson, setExportingJson] = useState(false);

  // Edit / delete state
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Trigger data fetching whenever level or path changes
  useEffect(() => {
    fetchData();
  }, [level, path.district, path.township, path.village, path.householdNo]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    setSearch('');
    
    try {
      if (level === 1) {
        const { data, error } = await supabase.from('households').select('district');
        if (error) throw error;
        const unique = [...new Set(data.filter(d => d.district).map(d => d.district))].sort();
        setDataList(unique.map(name => ({ id: name, name })));
      } 
      else if (level === 2) {
        const { data, error } = await supabase.from('households').select('township').eq('district', path.district);
        if (error) throw error;
        const unique = [...new Set(data.filter(d => d.township).map(d => d.township))].sort();
        setDataList(unique.map(name => ({ id: name, name })));
      }
      else if (level === 3) {
        const { data, error } = await supabase.from('households').select('ward_village_group').eq('township', path.township);
        if (error) throw error;
        const unique = [...new Set(data.filter(d => d.ward_village_group).map(d => d.ward_village_group))].sort();
        setDataList(unique.map(name => ({ id: name, name })));
      }
      else if (level === 4) {
        const { data, error } = await supabase
          .from('households')
          .select('id, name, household_no, gender, occupation, date_of_birth')
          .eq('ward_village_group', path.village)
          .ilike('household_relationship', '%ဦးစီး%');
        if (error) throw error;
        setDataList(data || []);
      }
      else if (level === 5) {
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
      }
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleNavigate = (newLevel, payload) => {
    setPath(prev => ({ ...prev, ...payload }));
    setLevel(newLevel);
  };

  const jumpToLevel = (targetLevel) => {
    if (targetLevel >= level) return;
    const newPath = { ...path };
    if (targetLevel < 5) { newPath.householdNo = null; newPath.headName = null; }
    if (targetLevel < 4) newPath.village = null;
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

  const filteredData = dataList.filter(item => 
    item.name?.toLowerCase().includes(search.toLowerCase()) || 
    item.household_no?.toLowerCase().includes(search.toLowerCase())
  );

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
    <div className="p-8 max-w-7xl mx-auto min-h-screen bg-white">
      
      {/* HEADER & BREADCRUMBS */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <h2 style={{ fontSize: '20px', margin: '0 0 8px 0', color: '#1A1A1A', fontWeight: '500', letterSpacing: '0.02em' }}>CENTRAL DATABASE</h2>
          <button
            type="button"
            onClick={exportAllJson}
            disabled={exportingJson}
            className="flex items-center gap-2 border border-gray-300 text-gray-600 hover:border-gray-900 hover:text-gray-900 px-4 py-2 text-xs uppercase font-medium transition-colors disabled:opacity-50"
          >
            {exportingJson ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
            {exportingJson ? 'Exporting...' : 'Export All JSON'}
          </button>
        </div>
        
        <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-gray-500 uppercase letter-spacing-0.02">
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
              <button onClick={() => jumpToLevel(3)} className={`flex items-center gap-1 hover:text-gray-900 transition-colors ${level === 3 ? 'text-gray-900 font-bold' : ''}`}>
                <Home size={14} /> {path.township}
              </button>
            </>
          )}

          {path.village && (
            <>
              <ChevronRight size={14} />
              <button onClick={() => jumpToLevel(4)} className={`flex items-center gap-1 hover:text-gray-900 transition-colors ${level === 4 ? 'text-gray-900 font-bold' : ''}`}>
                <Users size={14} /> {path.village}
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
        <div className="p-4 border border-gray-200 text-gray-900 text-xs mb-8 flex items-center gap-3">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* CONTROLS */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
        {level > 1 ? (
          <button onClick={goBack} className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-900 hover:bg-gray-50 transition-colors font-medium text-xs uppercase letter-spacing-0.05">
            <ArrowLeft size={14} /> Back
          </button>
        ) : <div />}

        {level < 5 && (
          <div className="relative w-full sm:w-96">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
              <Search size={14} />
            </div>
            <input 
              type="text" 
              placeholder={`Search ${level === 1 ? 'districts' : level === 2 ? 'townships' : level === 3 ? 'villages' : 'household heads'}...`} 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-none focus:outline-none focus:border-gray-900 transition-colors text-xs"
            />
          </div>
        )}
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="border border-gray-200 bg-white min-h-[400px]">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-[400px] text-gray-500 gap-3">
            <Loader2 className="animate-spin text-gray-900" size={32} />
            <span className="font-medium text-xs uppercase">Fetching Records...</span>
          </div>
        ) : (
          <>
            {/* LEVELS 1, 2, 3: CARDS GRID */}
            {level <= 3 && (
              <div className="p-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 bg-white min-h-[400px]">
                {filteredData.length === 0 ? (
                  <div className="col-span-full flex justify-center items-center h-40 text-gray-500 text-xs uppercase">No records found.</div>
                ) : (
                  filteredData.map((item, idx) => (
                    <div 
                      key={idx} 
                      onClick={() => {
                        if (level === 1) handleNavigate(2, { district: item.name });
                        if (level === 2) handleNavigate(3, { township: item.name });
                        if (level === 3) handleNavigate(4, { village: item.name });
                      }}
                      className="bg-white p-5 border border-gray-200 hover:border-gray-900 cursor-pointer transition-all flex items-center justify-between group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="text-gray-900">
                          {level === 1 && <MapIcon size={16} />}
                          {level === 2 && <MapPin size={16} />}
                          {level === 3 && <Home size={16} />}
                        </div>
                        <span className="font-medium text-gray-900 text-xs">{item.name}</span>
                      </div>
                      <ChevronRight size={14} className="text-gray-400 group-hover:text-gray-900 transition-colors" />
                    </div>
                  ))
                )}
              </div>
            )}

            {/* LEVEL 4: HOUSEHOLD HEADS TABLE */}
            {level === 4 && (
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
                      <tr><td colSpan={5} className="p-12 text-center text-gray-500 text-xs uppercase">No household heads found.</td></tr>
                    ) : (
                      filteredData.map(head => (
                        <tr key={head.id} className="hover:bg-gray-50 transition-colors">
                          <td style={tdStyle} className="font-medium">{head.name}</td>
                          <td style={tdStyle} className="font-mono">{head.household_no}</td>
                          <td style={tdStyle}>{head.gender}</td>
                          <td style={tdStyle}>{head.occupation || '-'}</td>
                          <td style={{ ...tdStyle, textAlign: 'right' }}>
                            <button 
                              onClick={() => handleNavigate(5, { headName: head.name, householdNo: head.household_no })}
                              className="inline-flex items-center gap-1 bg-white border border-gray-900 text-gray-900 px-3 py-1 text-xs font-medium hover:bg-gray-50 transition-colors uppercase"
                            >
                              View Family <ChevronRight size={14} />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* LEVEL 5: FAMILY MEMBERS TABLE */}
            {level === 5 && (
              <div>
                {/* Delete confirmation modal */}
                {deleteConfirmId && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                    <div className="bg-white border border-gray-200 p-6 w-80 shadow-lg">
                      <p className="text-sm font-semibold text-gray-900 mb-2">Delete Member?</p>
                      <p className="text-xs text-gray-500 mb-6">This will permanently remove this record from the database. This action cannot be undone.</p>
                      <div className="flex gap-3 justify-end">
                        <button onClick={cancelDelete} disabled={deleting} className="px-4 py-2 text-xs border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors">
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

                <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900 text-xs uppercase letter-spacing-0.05">Family Roster: {path.householdNo}</h3>
                  <span className="text-[10px] text-gray-400 uppercase">Click <Pencil size={10} className="inline" /> to edit a row</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr>
                        <th style={thStyle}>Name</th>
                        <th style={thStyle}>Relationship</th>
                        <th style={thStyle}>Gender</th>
                        <th style={thStyle}>Date of Birth</th>
                        <th style={thStyle}>Father's Name</th>
                        <th style={thStyle}>Mother's Name</th>
                        <th style={thStyle}>Occupation</th>
                        <th style={thStyle}>Nationality</th>
                        <th style={thStyle}>Religious</th>
                        <th style={{ ...thStyle, textAlign: 'center', width: '90px' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {familyMembers.length === 0 ? (
                        <tr><td colSpan={10} className="p-12 text-center text-gray-500 text-xs uppercase">No family members found.</td></tr>
                      ) : (
                        familyMembers.map((member) => {
                          const isEditing = editingId === member.id;
                          const cellCls = "border-none outline-none bg-yellow-50 border-b border-yellow-300 w-full text-xs px-1 py-0.5 font-inherit";
                          return (
                            <tr key={member.id} className={`transition-colors ${isEditing ? 'bg-yellow-50' : 'hover:bg-gray-50'}`}>
                              {/* Name */}
                              <td style={tdStyle} className="font-medium min-w-[120px]">
                                {isEditing
                                  ? <input className={cellCls} value={editForm.name || ''} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
                                  : member.name
                                }
                              </td>
                              {/* Relationship */}
                              <td style={tdStyle} className="min-w-[100px]">
                                {isEditing
                                  ? <input className={cellCls} value={editForm.household_relationship || ''} onChange={e => setEditForm(f => ({ ...f, household_relationship: e.target.value }))} />
                                  : member.household_relationship === 'ဦးစီး'
                                    ? <span className="border border-gray-900 text-gray-900 px-1.5 py-0.5 text-[10px] font-bold uppercase">HEAD</span>
                                    : <span className="text-gray-600">{member.household_relationship}</span>
                                }
                              </td>
                              {/* Gender */}
                              <td style={tdStyle} className="min-w-[60px]">
                                {isEditing
                                  ? <input className={cellCls} value={editForm.gender || ''} onChange={e => setEditForm(f => ({ ...f, gender: e.target.value }))} />
                                  : member.gender
                                }
                              </td>
                              {/* DOB */}
                              <td style={tdStyle} className="font-mono min-w-[100px]">
                                {isEditing
                                  ? <input className={cellCls} value={editForm.date_of_birth || ''} onChange={e => setEditForm(f => ({ ...f, date_of_birth: e.target.value }))} />
                                  : member.date_of_birth
                                }
                              </td>
                              {/* Father */}
                              <td style={tdStyle} className="min-w-[100px]">
                                {isEditing
                                  ? <input className={cellCls} value={editForm.fathers_name || ''} onChange={e => setEditForm(f => ({ ...f, fathers_name: e.target.value }))} />
                                  : member.fathers_name || <span className="text-gray-300">—</span>
                                }
                              </td>
                              {/* Mother */}
                              <td style={tdStyle} className="min-w-[100px]">
                                {isEditing
                                  ? <input className={cellCls} value={editForm.mothers_name || ''} onChange={e => setEditForm(f => ({ ...f, mothers_name: e.target.value }))} />
                                  : member.mothers_name || <span className="text-gray-300">—</span>
                                }
                              </td>
                              {/* Occupation */}
                              <td style={tdStyle} className="min-w-[90px]">
                                {isEditing
                                  ? <input className={cellCls} value={editForm.occupation || ''} onChange={e => setEditForm(f => ({ ...f, occupation: e.target.value }))} />
                                  : member.occupation || <span className="text-gray-300">—</span>
                                }
                              </td>
                              {/* Nationality */}
                              <td style={tdStyle} className="min-w-[80px]">
                                {isEditing
                                  ? <input className={cellCls} value={editForm.nationality || ''} onChange={e => setEditForm(f => ({ ...f, nationality: e.target.value }))} />
                                  : member.nationality || <span className="text-gray-300">—</span>
                                }
                              </td>
                              {/* Religious */}
                              <td style={tdStyle} className="min-w-[80px]">
                                {isEditing
                                  ? <input className={cellCls} value={editForm.religious || ''} onChange={e => setEditForm(f => ({ ...f, religious: e.target.value }))} />
                                  : member.religious || <span className="text-gray-300">—</span>
                                }
                              </td>
                              {/* Actions */}
                              <td style={{ ...tdStyle, textAlign: 'center', whiteSpace: 'nowrap' }}>
                                {isEditing ? (
                                  <div className="flex items-center justify-center gap-2">
                                    <button
                                      onClick={saveEdit}
                                      disabled={saving}
                                      title="Save"
                                      className="flex items-center gap-1 bg-gray-900 text-white px-2 py-1 text-[10px] uppercase font-bold hover:bg-gray-700 transition-colors disabled:opacity-50"
                                    >
                                      {saving ? <Loader2 size={10} className="animate-spin" /> : <Check size={10} />}
                                      Save
                                    </button>
                                    <button
                                      onClick={cancelEdit}
                                      disabled={saving}
                                      title="Cancel"
                                      className="flex items-center gap-1 border border-gray-300 text-gray-600 px-2 py-1 text-[10px] uppercase font-bold hover:bg-gray-100 transition-colors disabled:opacity-50"
                                    >
                                      <X size={10} /> Cancel
                                    </button>
                                  </div>
                                ) : (
                                  <div className="flex items-center justify-center gap-2">
                                    <button
                                      onClick={() => startEdit(member)}
                                      title="Edit"
                                      className="p-1.5 border border-gray-300 text-gray-600 hover:border-gray-900 hover:text-gray-900 transition-colors"
                                    >
                                      <Pencil size={12} />
                                    </button>
                                    <button
                                      onClick={() => confirmDelete(member.id)}
                                      title="Delete"
                                      className="p-1.5 border border-gray-300 text-gray-400 hover:border-red-500 hover:text-red-600 transition-colors"
                                    >
                                      <Trash2 size={12} />
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
                </div>

                {familyMembers.length > 0 && (
                  <div className="px-6 py-3 bg-white border-t border-gray-200 flex flex-wrap items-center justify-end gap-3">
                    <span className="text-[11px] text-gray-500 uppercase letter-spacing-0.05 mr-auto">Print / Export Household Registration</span>
                    <button
                      type="button"
                      onClick={() => printHouseholdPdf(path.householdNo, familyMembers)}
                      className="flex items-center gap-2 bg-gray-900 hover:bg-white hover:text-gray-900 border border-gray-900 text-white px-4 py-2 rounded-none font-medium transition-colors text-xs uppercase letter-spacing-0.05"
                    >
                      <Printer size={14} />
                      Print PDF
                    </button>
                    <button
                      type="button"
                      onClick={() => exportHouseholdExcel(path.householdNo, familyMembers)}
                      className="flex items-center gap-2 bg-white border border-gray-900 text-gray-900 hover:bg-gray-900 hover:text-white px-4 py-2 rounded-none font-medium transition-colors text-xs uppercase letter-spacing-0.05"
                    >
                      <FileSpreadsheet size={14} />
                      Export Excel
                    </button>
                    <button
                      type="button"
                      onClick={exportHouseholdJson}
                      className="flex items-center gap-2 bg-white border border-gray-900 text-gray-900 hover:bg-gray-900 hover:text-white px-4 py-2 rounded-none font-medium transition-colors text-xs uppercase letter-spacing-0.05"
                    >
                      <Download size={14} />
                      Export JSON
                    </button>
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
