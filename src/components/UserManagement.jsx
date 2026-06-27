import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import {
  UserPlus, Shield, User, Key, Hash, Loader2, CheckCircle2, AlertTriangle, X,
  Users, Circle, ToggleLeft, ToggleRight, UserCheck, UserX, Activity, ChevronDown, Mail,
  RefreshCw, MapPin, Pencil, Save
} from 'lucide-react';
import { getProfileType, ROLE_LABELS } from '../lib/roleHelper';

// ─── Constants ────────────────────────────────────────────────────────────────
const DISTRICTS = ['နမ့်ခမ်း ခရိုင်', 'နမ့်ဆန် ခရိုင်', 'မန်တုံ ခရိုင်'];

function formatLastSeen(ts) {
  if (!ts) return 'Never';
  const diff = Math.floor((Date.now() - new Date(ts)) / 1000);
  if (diff < 60)    return 'Just now';
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(ts).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function isOnline(ts) {
  if (!ts) return false;
  return (Date.now() - new Date(ts)) < 5 * 60 * 1000; // within 5 min
}

// ─── Component ───────────────────────────────────────────────────────────────

const UserManagement = ({ user }) => {
  // ── Create-user form ──────────────────────────────────────────────────────
  const [formData, setFormData] = useState({ username: '', password: '', role: 'field', email: '', access_level: 'central', allowed_districts: [], allowed_townships: [] });
  const [loading,  setLoading]  = useState(false);
  const [status,   setStatus]   = useState(null);

  // ── User list ─────────────────────────────────────────────────────────────
  const [userList,     setUserList]     = useState([]);
  const [listLoading,  setListLoading]  = useState(false);
  const [listError,    setListError]    = useState(null);
  const [togglingId,   setTogglingId]   = useState(null);
  const [activeTab,    setActiveTab]    = useState('list'); // 'list' | 'create'
  const [filterRole,   setFilterRole]   = useState('all');
  const [filterStatus, setFilterStatus] = useState('all'); // 'all' | 'active' | 'disabled'



  // ── District / Township edit state ───────────────────────────────────────
  const [editingDistrictsFor, setEditingDistrictsFor] = useState(null);
  const [editedRole,       setEditedRole]       = useState('field');
  const [editedLevel,      setEditedLevel]      = useState('central');
  const [editedDistricts,  setEditedDistricts]  = useState([]);
  const [editedTownships,  setEditedTownships]  = useState([]);
  const [savingDistricts,  setSavingDistricts]  = useState(false);
  const [allTownships,     setAllTownships]     = useState({});
  const [loadingTownships, setLoadingTownships] = useState(false);
  const townshipsLoadedRef = useRef(false);

  const canToggleUsers = user?.role === 'system' || user?.role === 'master';
  const isAdminLevel   = user?.access_level === 'central' || user?.access_level === 'district' || user?.access_level === 'township';

  if (user?.role !== 'system' && user?.role !== 'master') {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', color: '#737373', fontFamily: "Inter, sans-serif" }}>
        <h2 style={{ color: '#DC2626', fontSize: '20px', fontWeight: '600', marginBottom: '12px' }}>ACCESS DENIED</h2>
        <p style={{ fontSize: '13px' }}>Only System Administrators are authorized to view or manage user accounts.</p>
      </div>
    );
  }



  // ── Load user list ────────────────────────────────────────────────────────
  const loadUsers = useCallback(async () => {
    setListLoading(true);
    setListError(null);
    try {
      // Try full select first; fall back if username/email columns don't exist yet
      let { data, error } = await supabase
        .from('profiles')
        .select('id, role, is_active, last_seen_at, created_at, username, email, access_level, allowed_districts, allowed_townships')
        .order('created_at', { ascending: false });
      if (error && error.message?.includes('username')) {
        // username column not yet in DB — run the migration SQL
        const res = await supabase
          .from('profiles')
          .select('id, role, is_active, last_seen_at, created_at')
          .order('created_at', { ascending: false });
        data = res.data;
        error = res.error;
      }
      if (error) throw error;
      setUserList(data || []);
    } catch (err) {
      console.error('Failed to load users:', err);
      setListError(err.message || 'Failed to load users.');
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);



  // ── Toggle active/disabled ────────────────────────────────────────────────
  const toggleUserActive = async (targetUser) => {
    if (!canToggleUsers) return;
    if (targetUser.id === user?.id) return; // can't disable yourself
    setTogglingId(targetUser.id);
    try {
      const newState = !targetUser.is_active;
      const { error } = await supabase
        .from('profiles')
        .update({ is_active: newState })
        .eq('id', targetUser.id);
      if (error) throw error;
      setUserList(prev =>
        prev.map(u => u.id === targetUser.id ? { ...u, is_active: newState } : u)
      );
    } catch (err) {
      console.error('Toggle failed:', err);
    } finally {
      setTogglingId(null);
    }
  };

  // ── Load all townships grouped by district ────────────────────────────────
  const loadAllTownships = useCallback(async () => {
    if (townshipsLoadedRef.current) return;
    setLoadingTownships(true);
    try {
      const results = await Promise.all(
        DISTRICTS.map(d => supabase.rpc('stats_townships', { p_district: d }))
      );
      const grouped = {};
      DISTRICTS.forEach((d, i) => {
        grouped[d] = (results[i].data || []).map(t => t.name);
      });
      setAllTownships(grouped);
      townshipsLoadedRef.current = true;
    } catch (err) {
      console.error('Failed to load townships:', err);
    } finally {
      setLoadingTownships(false);
    }
  }, []);

  // ── Save district/township access for existing user ───────────────────────
  const saveDistrictAccess = async (userId) => {
    setSavingDistricts(true);
    try {
      const newLevel     = editedLevel;
      let newDistricts   = (newLevel === 'district' || newLevel === 'viewer') ? editedDistricts : [];
      const newTownships = (newLevel === 'township' || newLevel === 'sub_township') ? editedTownships : [];
      // For township / sub_township level: auto-compute parent districts from selected townships
      if ((newLevel === 'township' || newLevel === 'sub_township') && newTownships.length > 0) {
        const parentSet = new Set();
        Object.entries(allTownships).forEach(([dist, towns]) => {
          if (towns.some(t => newTownships.includes(t))) parentSet.add(dist);
        });
        newDistricts = Array.from(parentSet);
      }
      const { error } = await supabase
        .from('profiles')
        .update({ role: editedRole, access_level: newLevel, allowed_districts: newDistricts, allowed_townships: newTownships })
        .eq('id', userId);
      if (error) throw error;
      setUserList(prev => prev.map(u =>
        u.id === userId
          ? { ...u, role: editedRole, access_level: newLevel, allowed_districts: newDistricts, allowed_townships: newTownships }
          : u
      ));
      setEditingDistrictsFor(null);
    } catch (err) {
      alert('Failed to save access: ' + err.message);
    } finally {
      setSavingDistricts(false);
    }
  };

  // ── Form ──────────────────────────────────────────────────────────────────
  const handleChange = e => {
    const { name, value, checked } = e.target;
    if (name === 'allowed_districts') {
      setFormData(prev => ({
        ...prev,
        allowed_districts: checked ? [...prev.allowed_districts, value] : prev.allowed_districts.filter(d => d !== value),
      }));
      return;
    }
    if (name === 'allowed_townships') {
      setFormData(prev => ({
        ...prev,
        allowed_townships: checked ? [...prev.allowed_townships, value] : prev.allowed_townships.filter(t => t !== value),
      }));
      return;
    }
    if (name === 'access_level') {
      if (value === 'central')   setFormData(prev => ({ ...prev, access_level: value, allowed_districts: [], allowed_townships: [] }));
      else if (value === 'district' || value === 'viewer') setFormData(prev => ({ ...prev, access_level: value, allowed_townships: [] }));
      else if (value === 'township' || value === 'sub_township') { setFormData(prev => ({ ...prev, access_level: value, allowed_districts: [] })); loadAllTownships(); }
      return;
    }
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setStatus(null);
    try {
      const { data, error } = await supabase.functions.invoke('create-user', {
        body: { ...formData, displayName: formData.username },
      });
      if (error) throw error;
      const emailNote = formData.email ? ' Email OTP will be required at login.' : ' No email set — OTP step will be skipped.';
      setStatus({ type: 'success', text: `User account created successfully.${emailNote}` });
      setFormData({ username: '', password: '', role: 'field', email: '', access_level: 'central', allowed_districts: [], allowed_townships: [] });
      await loadUsers();
    } catch (err) {
      setStatus({ type: 'error', text: err.message || 'An unexpected error occurred during user creation.' });
    } finally {
      setLoading(false);
    }
  };

  // ── Derived stats ─────────────────────────────────────────────────────────
  const totalUsers    = userList.length;
  const activeUsers   = userList.filter(u => u.is_active !== false).length;
  const disabledUsers = userList.filter(u => u.is_active === false).length;
  const onlineUsers   = userList.filter(u => isOnline(u.last_seen_at)).length;

  // ── Filtered list ─────────────────────────────────────────────────────────
  const filteredList = userList.filter(u => {
    const roleMatch   = filterRole   === 'all' || u.role === filterRole;
    const statusMatch = filterStatus === 'all'
      ? true
      : filterStatus === 'active'   ? u.is_active !== false
      : filterStatus === 'disabled' ? u.is_active === false
      : true;
    return roleMatch && statusMatch;
  });

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-8 p-6 sm:p-8 xl:p-10 max-w-7xl xl:max-w-[1440px] mx-auto">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div>
        <h2 style={{ fontSize: '20px', margin: '0 0 8px 0', color: '#1A1A1A', fontWeight: '500', letterSpacing: '0.02em' }}>
          USER MANAGEMENT
        </h2>
        <p style={{ margin: 0, color: '#737373', fontSize: '12px' }}>
          Manage officer accounts and access states.
        </p>
      </div>

      {/* ── Stats Bar ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { icon: <Users size={14} />,     label: 'Total Accounts', value: totalUsers,    color: '#1A1A1A' },
          { icon: <UserCheck size={14} />, label: 'Active',         value: activeUsers,   color: '#065F46' },
          { icon: <UserX size={14} />,     label: 'Disabled',       value: disabledUsers, color: '#B91C1C' },
          { icon: <Activity size={14} />,  label: 'Online Now',     value: onlineUsers,   color: '#0369A1' },
        ].map(({ icon, label, value, color }) => (
          <div key={label} className="border border-gray-200 bg-white p-4">
            <div className="flex items-center gap-1.5 text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-2">
              <span style={{ color }}>{icon}</span> {label}
            </div>
            <div className="text-2xl font-bold font-mono" style={{ color }}>{value}</div>
          </div>
        ))}
      </div>

      {/* ── Tab Switcher ────────────────────────────────────────────────────── */}
      <div className="border-b border-gray-200 flex gap-0">
        {[
          { key: 'list',     label: 'User Accounts',            icon: <Users size={13} /> },
          { key: 'create',   label: 'Create Account',           icon: <UserPlus size={13} /> },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-5 py-3 text-[11px] font-bold uppercase tracking-wider border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'border-gray-900 text-gray-900'
                : 'border-transparent text-gray-400 hover:text-gray-700'
            }`}
          >
            {tab.icon} {tab.label}
            {tab.key === 'list' && (
              <span className={`ml-1 px-1.5 py-0.5 text-[9px] font-bold rounded-full ${activeTab === 'list' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500'}`}>
                {totalUsers}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── USER LIST TAB ────────────────────────────────────────────────────── */}
      {activeTab === 'list' && (
        <div className="space-y-4">

          {/* Filters */}
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex items-center gap-2">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Role</label>
              <div className="relative">
                <select
                  value={filterRole}
                  onChange={e => setFilterRole(e.target.value)}
                  className="pl-2 pr-6 py-1.5 border border-gray-200 text-[11px] text-gray-700 bg-white focus:outline-none focus:border-gray-900 appearance-none cursor-pointer"
                >
                  <option value="all" style={{ backgroundColor: '#FFFFFF', color: '#1A1A1A' }}>All Roles</option>
                  {Object.entries(ROLE_LABELS).map(([k, v]) => (
                    <option key={k} value={k} style={{ backgroundColor: '#FFFFFF', color: '#1A1A1A' }}>{v.label}</option>
                  ))}
                </select>
                <ChevronDown size={10} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Status</label>
              <div className="flex gap-1">
                {[['all','All'],['active','Active'],['disabled','Disabled']].map(([val, lbl]) => (
                  <button
                    key={val}
                    onClick={() => setFilterStatus(val)}
                    className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider border transition-colors ${
                      filterStatus === val
                        ? 'bg-gray-900 text-white border-gray-900'
                        : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
                    }`}
                  >
                    {lbl}
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={loadUsers}
              disabled={listLoading}
              className="ml-auto flex items-center gap-1.5 text-[10px] text-gray-500 hover:text-gray-900 uppercase tracking-wider transition-colors"
            >
              <RefreshCw size={11} className={listLoading ? 'animate-spin' : ''} /> Refresh
            </button>
          </div>

          {/* Error */}
          {listError && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 text-red-700 text-xs">
              <AlertTriangle size={13} /> {listError}
              <button onClick={() => setListError(null)} className="ml-auto"><X size={12} /></button>
            </div>
          )}

          {/* Table */}
          <div className="border border-gray-200 bg-white overflow-hidden">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left px-4 py-3 text-[9px] font-bold text-gray-400 uppercase tracking-wider">Officer</th>
                  <th className="text-left px-4 py-3 text-[9px] font-bold text-gray-400 uppercase tracking-wider hidden sm:table-cell">Role</th>
                  <th className="text-left px-4 py-3 text-[9px] font-bold text-gray-400 uppercase tracking-wider hidden lg:table-cell">District Access</th>
                  <th className="text-left px-4 py-3 text-[9px] font-bold text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-3 text-[9px] font-bold text-gray-400 uppercase tracking-wider hidden md:table-cell">Last Seen</th>
                  {canToggleUsers && (
                    <th className="text-right px-4 py-3 text-[9px] font-bold text-gray-400 uppercase tracking-wider">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {listLoading ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-gray-400">
                      <div className="flex flex-col items-center gap-2">
                        <Loader2 size={20} className="animate-spin" />
                        <span className="text-[10px] uppercase tracking-wider">Loading accounts…</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredList.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-gray-400 text-[11px]">
                      No accounts match the current filter.
                    </td>
                  </tr>
                ) : (
                  filteredList.map((u) => {
                    const online   = isOnline(u.last_seen_at);
                    const active   = u.is_active !== false;
                    const isSelf   = u.id === user?.id;
                    const toggling = togglingId === u.id;
                    const roleInfo = ROLE_LABELS[u.role] || { label: u.role, color: '#737373', bg: '#F5F5F5' };
                    const isEditingThis      = editingDistrictsFor === u.id;
                    const isDistrictLevel     = u.access_level === 'district';
                    const isTownshipLevel     = u.access_level === 'township';
                    const isViewerLevel       = u.access_level === 'viewer';
                    const isSubTownshipLevel  = u.access_level === 'sub_township';

                    return (
                      <React.Fragment key={u.id}>
                        <tr className={`border-b border-gray-100 transition-colors ${!active ? 'bg-gray-50 opacity-60' : 'hover:bg-gray-50'}`}>

                          {/* Officer */}
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-2.5">
                              <div className="relative flex-shrink-0">
                                <div className="w-7 h-7 bg-gray-100 border border-gray-200 flex items-center justify-center text-[11px] font-bold text-gray-600 select-none uppercase"
                                  style={{ borderLeft: `3px solid ${getProfileType(u.role, u.access_level).color}` }}>
                                  {(u.username || u.id || '?')[0]}
                                </div>
                                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white"
                                  style={{ background: online ? '#22C55E' : '#D1D5DB' }} title={online ? 'Online' : 'Offline'} />
                              </div>
                              <div>
                                <div className="font-semibold text-gray-900 text-[11px]">
                                  {u.username || <span className="text-gray-400 italic text-[10px]">{u.id.slice(0, 8)}</span>}
                                  {isSelf && <span className="ml-1.5 text-[9px] font-bold text-gray-400 bg-gray-100 px-1 py-0.5">(YOU)</span>}
                                </div>
                                <div className="text-[9px] text-gray-400 font-mono leading-none mb-1">{u.username ? `${u.username}@tps.idtl` : u.email || '—'}</div>
                                <div style={{ fontSize: '9px', fontWeight: '600', color: getProfileType(u.role, u.access_level).color, letterSpacing: '0.01em' }}>
                                  {getProfileType(u.role, u.access_level).typicalPerson}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Role */}
                          <td className="px-4 py-3.5 hidden sm:table-cell">
                            <span className="inline-flex items-center px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider border"
                              style={{ color: roleInfo.color, background: roleInfo.bg, borderColor: roleInfo.color + '30' }}>
                              {roleInfo.label}
                            </span>
                          </td>

                          {/* District / Township Access */}
                          <td className="px-4 py-3.5 hidden lg:table-cell">
                            <div className="flex items-center gap-1 flex-wrap">
                              {isDistrictLevel ? (
                                (u.allowed_districts || []).length === 0
                                  ? <span className="text-[9px] font-bold bg-red-50 text-red-600 border border-red-200 px-2 py-0.5">No Districts</span>
                                  : (u.allowed_districts || []).map(d => (
                                      <span key={d} className="text-[9px] font-bold bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.5">{d.replace(' ခရိုင်', '')}</span>
                                    ))
                              ) : isTownshipLevel ? (
                                (u.allowed_townships || []).length === 0
                                  ? <span className="text-[9px] font-bold bg-red-50 text-red-600 border border-red-200 px-2 py-0.5">No Townships</span>
                                  : <>
                                      {(u.allowed_townships || []).slice(0, 2).map(t => (
                                        <span key={t} className="text-[9px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 px-1.5 py-0.5">{t}</span>
                                      ))}
                                      {(u.allowed_townships || []).length > 2 && (
                                        <span className="text-[9px] text-gray-400">+{(u.allowed_townships || []).length - 2} more</span>
                                      )}
                                    </>
                              ) : isViewerLevel ? (
                                <span className="text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5">မြင်းသာ (Viewer)</span>
                              ) : isSubTownshipLevel ? (
                                <>
                                  {(u.allowed_townships || []).length === 0
                                    ? <span className="text-[9px] font-bold bg-red-50 text-red-600 border border-red-200 px-2 py-0.5">No Townships</span>
                                    : <>
                                        {(u.allowed_townships || []).slice(0, 2).map(t => (
                                          <span key={t} className="text-[9px] font-bold bg-orange-50 text-orange-700 border border-orange-200 px-1.5 py-0.5">{t}</span>
                                        ))}
                                        {(u.allowed_townships || []).length > 2 && (
                                          <span className="text-[9px] text-gray-400">+{(u.allowed_townships || []).length - 2} more</span>
                                        )}
                                      </>
                                  }
                                </>
                              ) : (
                                <span className="text-[9px] font-bold bg-gray-100 text-gray-500 border border-gray-200 px-2 py-0.5">Central</span>
                              )}
                            </div>
                          </td>

                          {/* Status */}
                          <td className="px-4 py-3.5">
                            {active ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[9px] font-bold bg-green-50 text-green-700 border border-green-200 uppercase tracking-wider">
                                <Circle size={6} fill="#16A34A" stroke="none" /> Active
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[9px] font-bold bg-red-50 text-red-700 border border-red-200 uppercase tracking-wider">
                                <Circle size={6} fill="#DC2626" stroke="none" /> Disabled
                              </span>
                            )}
                          </td>

                          {/* Last Seen */}
                          <td className="px-4 py-3.5 hidden md:table-cell">
                            <div className="flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: online ? '#22C55E' : '#D1D5DB' }} />
                              <span className={`text-[10px] font-medium ${online ? 'text-green-700' : 'text-gray-400'}`}>
                                {online ? 'Online' : formatLastSeen(u.last_seen_at)}
                              </span>
                            </div>
                          </td>

                          {/* Actions: toggle + edit districts */}
                          {canToggleUsers && (
                            <td className="px-4 py-3.5 text-right">
                              {isSelf ? (
                                <span className="text-[9px] text-gray-300 italic">—</span>
                              ) : (
                                <div className="flex items-center gap-2 justify-end">
                                  <button
                                    onClick={() => {
                                      if (isEditingThis) { setEditingDistrictsFor(null); return; }
                                      setEditedRole(u.role || 'field');
                                      setEditedLevel(u.access_level || 'central');
                                      setEditedDistricts(u.allowed_districts || []);
                                      setEditedTownships(u.allowed_townships || []);
                                      if ((u.access_level === 'township' || u.access_level === 'sub_township')) loadAllTownships();
                                      setEditingDistrictsFor(u.id);
                                    }}
                                    title="Edit district access"
                                    className={`flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1.5 border transition-all ${
                                      isEditingThis
                                        ? 'bg-blue-900 text-white border-blue-900'
                                        : 'border-blue-200 text-blue-600 hover:bg-blue-50 bg-white'
                                    }`}
                                  >
                                    <Pencil size={11} /> Edit
                                  </button>
                                  <button
                                    onClick={() => toggleUserActive(u)}
                                    disabled={toggling}
                                    title={active ? 'Disable this account' : 'Enable this account'}
                                    className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1.5 border transition-all ${
                                      active
                                        ? 'border-red-200 text-red-600 hover:bg-red-50 bg-white'
                                        : 'border-green-200 text-green-700 hover:bg-green-50 bg-white'
                                    } disabled:opacity-40`}
                                  >
                                    {toggling ? <Loader2 size={11} className="animate-spin" /> : active ? <><ToggleRight size={13} /> Disable</> : <><ToggleLeft size={13} /> Enable</>}
                                  </button>
                                </div>
                              )}
                            </td>
                          )}
                        </tr>

                        {/* Inline access edit panel */}
                        {isEditingThis && (
                          <tr className="border-b border-blue-200">
                            <td colSpan={6} className="px-6 py-5 bg-blue-50">
                              <div className="flex flex-col gap-4">
                                {/* Row 0: role radios */}
                                <div>
                                  <div className="text-[9px] font-bold text-gray-500 uppercase tracking-wider mb-2">Role</div>
                                  <div className="flex flex-wrap gap-2">
                                    {Object.entries(ROLE_LABELS).map(([val, info]) => (
                                      <label key={val} className={`flex items-center gap-2 px-3 py-2 border cursor-pointer text-[11px] font-semibold transition-colors ${
                                        editedRole === val ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-200 hover:border-gray-400'
                                      }`}>
                                        <input type="radio" name={`role-${u.id}`} value={val} checked={editedRole === val}
                                          onChange={() => setEditedRole(val)} className="hidden" />
                                        {info.label}
                                      </label>
                                    ))}
                                  </div>
                                </div>

                                {/* Row 1: access level radios */}
                                <div>
                                  <div className="text-[9px] font-bold text-gray-500 uppercase tracking-wider mb-2">Access Level</div>
                                  <div className="flex flex-wrap gap-2">
                                    {[['central','Central — Full Access'],['district','District — Restricted'],['township','Township — Most Restricted'],['viewer','Viewer — View Only'],['sub_township','Sub-Township — View Only']].map(([val, lbl]) => (
                                      <label key={val} className={`flex items-center gap-2 px-3 py-2 border cursor-pointer text-[11px] font-semibold transition-colors ${
                                        editedLevel === val ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-200 hover:border-gray-400'
                                      }`}>
                                        <input type="radio" name={`level-${u.id}`} value={val} checked={editedLevel === val}
                                          onChange={() => {
                                            setEditedLevel(val);
                                            if (val === 'central') { setEditedDistricts([]); setEditedTownships([]); }
                                            else if (val === 'district' || val === 'viewer') setEditedTownships([]);
                                            else if (val === 'township' || val === 'sub_township') { setEditedDistricts([]); loadAllTownships(); }
                                          }}
                                          className="hidden" />
                                        {lbl}
                                      </label>
                                    ))}
                                  </div>
                                </div>

                                {/* Row 2: district checkboxes (district + viewer levels) */}
                                {(editedLevel === 'district' || editedLevel === 'viewer') && (
                                  <div>
                                    <div className="text-[9px] font-bold text-gray-500 uppercase tracking-wider mb-2">Allowed Districts</div>
                                    <div className="flex flex-wrap gap-2">
                                      {DISTRICTS.map(d => {
                                        const chk = editedDistricts.includes(d);
                                        return (
                                          <label key={d} className={`flex items-center gap-2 px-3 py-2 border cursor-pointer text-[11px] font-semibold transition-colors ${
                                            chk ? 'bg-blue-700 text-white border-blue-700' : 'bg-white text-gray-700 border-gray-200 hover:border-blue-400'
                                          }`}>
                                            <input type="checkbox" value={d} checked={chk}
                                              onChange={e => setEditedDistricts(prev => e.target.checked ? [...prev, d] : prev.filter(x => x !== d))}
                                              className="hidden" />
                                            {d}
                                          </label>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}

                                {/* Row 3: township checkboxes grouped by district */}
                                {(editedLevel === 'township' || editedLevel === 'sub_township') && (
                                  <div>
                                    <div className="text-[9px] font-bold text-gray-500 uppercase tracking-wider mb-2">Allowed Townships</div>
                                    {loadingTownships ? (
                                      <div className="flex items-center gap-2 text-[10px] text-gray-500">
                                        <Loader2 size={12} className="animate-spin" /> Loading townships...
                                      </div>
                                    ) : (
                                      <div className="space-y-3">
                                        {DISTRICTS.map(d => (
                                          <div key={d}>
                                            <div className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">{d}</div>
                                            <div className="flex flex-wrap gap-2">
                                              {(allTownships[d] || []).map(t => {
                                                const chk = editedTownships.includes(t);
                                                return (
                                                  <label key={t} className={`flex items-center gap-2 px-3 py-2 border cursor-pointer text-[11px] font-semibold transition-colors ${
                                                    chk ? 'bg-indigo-700 text-white border-indigo-700' : 'bg-white text-gray-700 border-gray-200 hover:border-indigo-400'
                                                  }`}>
                                                    <input type="checkbox" value={t} checked={chk}
                                                      onChange={e => setEditedTownships(prev => e.target.checked ? [...prev, t] : prev.filter(x => x !== t))}
                                                      className="hidden" />
                                                    {t}
                                                  </label>
                                                );
                                              })}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                )}

                                {/* Live Profile Preview */}
                                {(() => {
                                  const preview = getProfileType(editedRole, editedLevel);
                                  return (
                                    <div style={{
                                      padding: '10px 12px',
                                      backgroundColor: '#FFFFFF',
                                      border: `1px solid ${preview.border}`,
                                      borderLeft: `4px solid ${preview.color}`,
                                      width: '100%',
                                      maxWidth: '340px',
                                      marginBottom: '8px'
                                    }}>
                                      <div style={{ fontSize: '9px', fontWeight: '700', color: '#737373', textTransform: 'uppercase', marginBottom: '2px' }}>
                                        Preview Profile Persona
                                      </div>
                                      <div style={{ fontSize: '11px', fontWeight: '700', color: '#1A1A1A' }}>
                                        {preview.typicalPerson}
                                      </div>
                                    </div>
                                  );
                                })()}

                                <div className="flex gap-2">
                                  <button onClick={() => setEditingDistrictsFor(null)}
                                    className="px-4 py-2 border border-gray-300 text-gray-600 text-[11px] font-bold uppercase tracking-wider hover:bg-gray-100 transition-colors">
                                    Cancel
                                  </button>
                                  <button onClick={() => saveDistrictAccess(u.id)} disabled={savingDistricts}
                                    className="flex items-center gap-1.5 px-4 py-2 bg-gray-900 text-white text-[11px] font-bold uppercase tracking-wider hover:bg-gray-700 transition-colors disabled:opacity-50">
                                    {savingDistricts ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Save
                                  </button>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>

            {/* Footer count */}
            {!listLoading && filteredList.length > 0 && (
              <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
                <span className="text-[9px] text-gray-400 uppercase tracking-wider">
                  Showing {filteredList.length} of {totalUsers} account{totalUsers !== 1 ? 's' : ''}
                </span>
                <span className="text-[9px] text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
                  {onlineUsers} online now
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── CREATE ACCOUNT TAB ───────────────────────────────────────────────── */}
      {activeTab === 'create' && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 xl:gap-10">
          {/* Info Panel */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-gray-50 border border-gray-200 p-6">
              <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                <Shield size={14} /> Security Protocols
              </h3>
              <ul className="space-y-3 text-xs text-gray-600 leading-relaxed">
                {[
                  'Users are created within the tps.idtl internal domain.',
                  'PIN codes must be at least 6 characters for field operations.',
                  'Account access is monitored via the central audit system.',
                  'Role changes must be audited by a System Administrator.',
                ].map((note, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-gray-900 font-bold">•</span>
                    {note.includes('tps.idtl')
                      ? <span>Users are created within the <strong>tps.idtl</strong> internal domain.</span>
                      : note}
                  </li>
                ))}
              </ul>
            </div>

            <div className="border border-gray-200 p-6 bg-white shadow-sm">
              <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                <Shield size={14} className="text-gray-900" /> System Roles & Access Matrix
              </h3>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[10px] border-collapse">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50 font-bold text-gray-500 uppercase tracking-wider">
                      <th className="py-2 px-3 text-left">Typical Person (Profile)</th>
                      <th className="py-2 px-3 text-left">System Role</th>
                      <th className="py-2 px-3 text-left">Access Level</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { person: 'Head system administrator', role: 'System Admin', level: 'Central', color: '#DC2626', bg: '#FEF2F2', border: '#FECACA' },
                      { person: 'Central Immigration Officer', role: 'Regional Admin', level: 'Ta\'ang Land', color: '#0F766E', bg: '#F0FDFA', border: '#CCFBF1' },
                      { person: 'District officer (manager)', role: 'Regional Admin', level: 'District', color: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE' },
                      { person: 'Township officer', role: 'Operations / Field Staff', level: 'Township', color: '#1E40AF', bg: '#EFF6FF', border: '#BFDBFE' },
                      { person: 'View-only observer (district)', role: 'Field Staff', level: 'Viewer', color: '#D97706', bg: '#FFFBEB', border: '#FDE68A' },
                      { person: 'View-only observer (township)', role: 'Field Staff', level: 'Sub-Township', color: '#B45309', bg: '#FFF7ED', border: '#FED7AA' },
                    ].map((row, idx) => (
                      <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                        <td className="py-2.5 px-3 font-semibold text-gray-800">{row.person}</td>
                        <td className="py-2.5 px-3">
                          <span className="inline-block px-1.5 py-0.5 text-[8.5px] font-bold border uppercase tracking-wider"
                            style={{ color: row.color, backgroundColor: row.bg, borderColor: row.border }}>
                            {row.role}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="inline-block px-1.5 py-0.5 text-[8.5px] font-bold bg-gray-100 text-gray-600 border border-gray-200 uppercase tracking-wider">
                            {row.level}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-[10px] text-gray-400 mt-4 leading-relaxed">
                * Mappings systematically enforce Row Level Security (RLS) and Sidebar navigation scopes. Field staff with view-only levels are restricted from modification.
              </p>
            </div>
          </div>

          {/* Creation Form */}
          <div className="lg:col-span-3">
            <div className="bg-white border border-gray-200">
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <h3 className="text-xs font-semibold text-gray-900 flex items-center gap-2 uppercase tracking-widest">
                  <UserPlus size={14} className="text-gray-900" /> Create Internal Account
                </h3>
              </div>

              <div className="p-6">
                {status && (
                  <div className={`mb-6 p-4 flex items-start gap-3 ${status.type === 'success' ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-800'}`}>
                    {status.type === 'success' ? <CheckCircle2 size={16} className="mt-0.5" /> : <AlertTriangle size={16} className="mt-0.5" />}
                    <div className="text-xs font-medium leading-normal">{status.text}</div>
                    <button onClick={() => setStatus(null)} className="ml-auto"><X size={14} /></button>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-600 mb-1 uppercase tracking-wider">Username</label>
                    <div className="flex">
                      <div className="bg-gray-100 border border-r-0 border-gray-200 px-3 flex items-center">
                        <User size={14} className="text-gray-400" />
                      </div>
                      <input
                        type="text" name="username" required
                        value={formData.username} onChange={handleChange}
                        className="w-full px-3 py-2 bg-white border border-gray-200 focus:outline-none focus:border-gray-900 transition-colors text-sm"
                        placeholder="e.g. kyaw.zayar"
                      />
                      <div className="bg-gray-50 border border-l-0 border-gray-200 px-3 flex items-center text-[10px] font-mono text-gray-400 uppercase">
                        @tps.idtl
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-gray-600 mb-1 uppercase tracking-wider">Account Password / PIN</label>
                    <div className="flex">
                      <div className="bg-gray-100 border border-r-0 border-gray-200 px-3 flex items-center">
                        <Key size={14} className="text-gray-400" />
                      </div>
                      <input
                        type="password" name="password" required
                        value={formData.password} onChange={handleChange}
                        className="w-full px-3 py-2 bg-white border border-gray-200 focus:outline-none focus:border-gray-900 transition-colors text-sm"
                        placeholder="••••••••"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-gray-600 mb-1 uppercase tracking-wider">
                      OTP Email <span className="normal-case font-normal text-gray-400">(optional — for 2FA)</span>
                    </label>
                    <div className="flex">
                      <div className="bg-gray-100 border border-r-0 border-gray-200 px-3 flex items-center">
                        <Mail size={14} className="text-gray-400" />
                      </div>
                      <input
                        type="email" name="email"
                        value={formData.email} onChange={handleChange}
                        className="w-full px-3 py-2 bg-white border border-gray-200 focus:outline-none focus:border-gray-900 transition-colors text-sm"
                        placeholder="officer@gmail.com (leave blank to skip OTP)"
                      />
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1">If set, officer must verify a 6-digit email code after PIN login.</p>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-gray-600 mb-1 uppercase tracking-wider">System Role</label>
                    <select
                      name="role" value={formData.role} onChange={handleChange}
                      className="w-full px-3 py-2.5 bg-white border border-gray-200 focus:outline-none focus:border-gray-900 transition-colors text-sm appearance-none cursor-pointer"
                    >
                      <option value="field" style={{ backgroundColor: '#FFFFFF', color: '#1A1A1A' }}>Field Staff</option>
                      <option value="ops" style={{ backgroundColor: '#FFFFFF', color: '#1A1A1A' }}>Operations</option>
                      <option value="regional" style={{ backgroundColor: '#FFFFFF', color: '#1A1A1A' }}>Regional Admin</option>
                      <option value="system" style={{ backgroundColor: '#FFFFFF', color: '#1A1A1A' }}>System Admin</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-gray-600 mb-1 uppercase tracking-wider">Data Access Level</label>
                    <div className="flex flex-wrap gap-2">
                      {[['central', 'Central — Full Access'], ['district', 'District — Restricted'], ['township', 'Township — Most Restricted'], ['viewer', 'Viewer — View Only'], ['sub_township', 'Sub-Township — View Only']].map(([val, lbl]) => (
                        <label key={val} className={`flex items-center gap-2 px-3 py-2.5 border cursor-pointer text-[11px] font-semibold transition-colors ${
                          formData.access_level === val ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-200 hover:border-gray-400'
                        }`}>
                          <input type="radio" name="access_level" value={val}
                            checked={formData.access_level === val} onChange={handleChange} className="hidden" />
                          {lbl}
                        </label>
                      ))}
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1">Central = all. District = districts only. Township = specific townships. Viewer = district view-only. Sub-Township = township view-only, no print/export.</p>

                    {/* Live Profile Preview Card */}
                    {(() => {
                      const preview = getProfileType(formData.role, formData.access_level);
                      return (
                        <div style={{
                          padding: '12px 14px',
                          backgroundColor: '#FAFAFA',
                          border: `1px solid ${preview.border}`,
                          borderLeft: `4px solid ${preview.color}`,
                          marginTop: '16px'
                        }}>
                          <div style={{ fontSize: '9px', fontWeight: '700', color: '#737373', textTransform: 'uppercase', tracking: '0.05em', marginBottom: '4px' }}>
                            Live Profile Persona Preview
                          </div>
                          <div style={{ fontSize: '12px', fontWeight: '700', color: '#1A1A1A', marginBottom: '2px' }}>
                            {preview.typicalPerson}
                          </div>
                          <div className="flex gap-2 mt-1">
                            <span style={{
                              fontSize: '8px',
                              fontWeight: '700',
                              color: preview.color,
                              backgroundColor: preview.bg,
                              border: `1px solid ${preview.border}`,
                              padding: '1px 5px',
                              textTransform: 'uppercase'
                            }}>
                              {preview.roleName}
                            </span>
                            <span style={{
                              fontSize: '8px',
                              fontWeight: '700',
                              color: '#4B5563',
                              backgroundColor: '#F3F4F6',
                              border: '1px solid #E5E7EB',
                              padding: '1px 5px',
                              textTransform: 'uppercase'
                            }}>
                              {preview.accessLevel}
                            </span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {(formData.access_level === 'district' || formData.access_level === 'viewer') && (  /* district picker */
                    <div>
                      <label className="block text-[10px] font-bold text-gray-600 mb-2 uppercase tracking-wider">Allowed Districts</label>
                      <div className="flex flex-wrap gap-2">
                        {DISTRICTS.map(d => {
                          const chk = formData.allowed_districts.includes(d);
                          return (
                            <label key={d} className={`flex items-center gap-2 px-3 py-2 border cursor-pointer text-[11px] font-semibold transition-colors ${
                              chk ? 'bg-blue-700 text-white border-blue-700' : 'bg-white text-gray-700 border-gray-200 hover:border-blue-400'
                            }`}>
                              <input type="checkbox" name="allowed_districts" value={d} checked={chk} onChange={handleChange} className="hidden" />
                              {d}
                            </label>
                          );
                        })}
                      </div>
                      {formData.allowed_districts.length === 0 && <p className="text-[10px] text-red-500 mt-1">Select at least one district.</p>}
                    </div>
                  )}

                  {(formData.access_level === 'township' || formData.access_level === 'sub_township') && (
                    <div>
                      <label className="block text-[10px] font-bold text-gray-600 mb-2 uppercase tracking-wider">Allowed Townships</label>
                      {loadingTownships ? (
                        <div className="flex items-center gap-2 text-[10px] text-gray-500"><Loader2 size={12} className="animate-spin" /> Loading townships...</div>
                      ) : (
                        <div className="space-y-3">
                          {DISTRICTS.map(d => (
                            <div key={d}>
                              <div className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">{d}</div>
                              <div className="flex flex-wrap gap-2">
                                {(allTownships[d] || []).map(t => {
                                  const chk = formData.allowed_townships.includes(t);
                                  return (
                                    <label key={t} className={`flex items-center gap-2 px-3 py-2 border cursor-pointer text-[11px] font-semibold transition-colors ${
                                      chk ? 'bg-indigo-700 text-white border-indigo-700' : 'bg-white text-gray-700 border-gray-200 hover:border-indigo-400'
                                    }`}>
                                      <input type="checkbox" name="allowed_townships" value={t} checked={chk} onChange={handleChange} className="hidden" />
                                      {t}
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      {formData.allowed_townships.length === 0 && !loadingTownships && <p className="text-[10px] text-red-500 mt-1">Select at least one township.</p>}
                    </div>
                  )}

                  <div className="pt-4">
                    <button
                      type="submit" disabled={loading}
                      className="w-full flex items-center justify-center gap-2 bg-gray-900 hover:bg-white hover:text-gray-900 border border-gray-900 text-white px-6 py-3 rounded-none font-bold transition-colors text-xs uppercase tracking-[0.2em] disabled:opacity-50"
                    >
                      {loading ? <><Loader2 size={16} className="animate-spin" /> Provisioning...</> : 'Create User Account'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;
