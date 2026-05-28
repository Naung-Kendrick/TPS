import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import {
  UserPlus, Shield, User, Key, Hash, Loader2, CheckCircle2, AlertTriangle, X,
  RefreshCw, Lock, Clock, ShieldAlert, Eye, EyeOff, Users, Circle,
  ToggleLeft, ToggleRight, UserCheck, UserX, Activity, ChevronDown, Mail
} from 'lucide-react';

// ─── Helpers ────────────────────────────────────────────────────────────────

const ROLE_LABELS = {
  system:   { label: 'System Admin',    color: '#1A1A1A', bg: '#F3F3F3' },
  master:   { label: 'Master',          color: '#7C3AED', bg: '#F5F3FF' },
  admin:    { label: 'Regional Admin',  color: '#0369A1', bg: '#EFF6FF' },
  ops:      { label: 'Operations',      color: '#B45309', bg: '#FFFBEB' },
  field:    { label: 'Field Staff',     color: '#065F46', bg: '#ECFDF5' },
};

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
  const [formData, setFormData] = useState({ username: '', password: '', role: 'field', email: '' });
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

  // ── Weekly Access Token ───────────────────────────────────────────────────
  const [tokenStatus,  setTokenStatus]  = useState(null);
  const [tokenLoading, setTokenLoading] = useState(false);
  const [tokenStatus2, setTokenStatus2] = useState(null);
  const [generatedCode, setGeneratedCode] = useState('');
  const [showCode,     setShowCode]     = useState(false);
  const [tokenSetting, setTokenSetting] = useState(false);

  const canManageToken = user?.role === 'system' || user?.role === 'master' || user?.role === 'admin';
  const canToggleUsers = user?.role === 'system' || user?.role === 'master' || user?.role === 'admin';

  // ── Load token status ─────────────────────────────────────────────────────
  const loadTokenStatus = useCallback(async () => {
    if (!canManageToken) return;
    setTokenLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_access_token_status');
      if (error) throw error;
      setTokenStatus(data?.[0] || null);
    } catch (err) {
      console.error('Token status fetch failed:', err);
    } finally {
      setTokenLoading(false);
    }
  }, [canManageToken]);

  // ── Load user list ────────────────────────────────────────────────────────
  const loadUsers = useCallback(async () => {
    setListLoading(true);
    setListError(null);
    try {
      // Try full select first; fall back if username/email columns don't exist yet
      let { data, error } = await supabase
        .from('profiles')
        .select('id, role, is_active, last_seen_at, created_at, username, email')
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

  useEffect(() => { loadTokenStatus(); }, [loadTokenStatus]);
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

  // ── Token helpers ─────────────────────────────────────────────────────────
  const generateNewCode = () => {
    setGeneratedCode(String(Math.floor(100000 + Math.random() * 900000)));
    setShowCode(false);
    setTokenStatus2(null);
  };

  const applyNewCode = async () => {
    if (!generatedCode) return;
    setTokenSetting(true);
    setTokenStatus2(null);
    try {
      const { error } = await supabase.rpc('set_access_token', { new_code: generatedCode });
      if (error) throw error;
      setTokenStatus2({ type: 'success', text: 'New 6-digit code activated. Expires in 7 days. Distribute securely.' });
      setGeneratedCode('');
      setShowCode(false);
      await loadTokenStatus();
    } catch (err) {
      setTokenStatus2({ type: 'error', text: err.message || 'Failed to set access token.' });
    } finally {
      setTokenSetting(false);
    }
  };

  // ── Form ──────────────────────────────────────────────────────────────────
  const handleChange  = e => setFormData({ ...formData, [e.target.name]: e.target.value });

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
      setFormData({ username: '', password: '', role: 'field', email: '' });
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
          Manage officer accounts, access states, and the weekly authentication code.
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

      {/* ── Weekly Access Token Panel ───────────────────────────────────────── */}
      {canManageToken && (
        <div className="border border-gray-200 bg-white">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h3 className="text-xs font-semibold text-gray-900 flex items-center gap-2 uppercase tracking-widest">
              <Lock size={14} /> TPS Authenticator — Weekly Access Code
            </h3>
            <button
              onClick={loadTokenStatus}
              disabled={tokenLoading}
              className="flex items-center gap-1.5 text-[10px] text-gray-500 hover:text-gray-900 uppercase tracking-wider transition-colors"
            >
              <RefreshCw size={11} className={tokenLoading ? 'animate-spin' : ''} /> Refresh
            </button>
          </div>

          <div className="p-6 space-y-5">
            {tokenStatus ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="border border-gray-200 p-4">
                  <div className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1"><Clock size={10} /> Expires</div>
                  <div className="text-xs font-semibold text-gray-900">
                    {new Date(tokenStatus.expires_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}
                  </div>
                  <div className="text-[10px] text-gray-400 mt-0.5">
                    {new Date(tokenStatus.expires_at) < new Date()
                      ? <span style={{ color: '#B71C1C', fontWeight: 600 }}>EXPIRED</span>
                      : `${Math.ceil((new Date(tokenStatus.expires_at) - new Date()) / 86400000)} day(s) remaining`
                    }
                  </div>
                </div>
                <div className="border border-gray-200 p-4">
                  <div className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1"><ShieldAlert size={10} /> Failed Attempts</div>
                  <div className={`text-xl font-bold font-mono ${tokenStatus.fail_count >= 5 ? 'text-red-700' : 'text-gray-900'}`}>
                    {tokenStatus.fail_count}
                  </div>
                  <div className="text-[10px] text-gray-400">out of 10 max</div>
                </div>
                <div className="border border-gray-200 p-4">
                  <div className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1">Status</div>
                  {tokenStatus.locked
                    ? <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold bg-red-50 text-red-700 border border-red-200">LOCKED</span>
                    : <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold bg-green-50 text-green-700 border border-green-200">ACTIVE</span>
                  }
                  <div className="text-[10px] text-gray-400 mt-1">Last set: {new Date(tokenStatus.created_at).toLocaleDateString('en-GB')}</div>
                </div>
              </div>
            ) : tokenLoading ? (
              <div className="flex items-center gap-2 text-xs text-gray-400"><Loader2 size={13} className="animate-spin" /> Loading token status...</div>
            ) : (
              <div className="text-xs text-gray-400 italic">No token configured yet.</div>
            )}

            <div className="border-t border-gray-100 pt-5 space-y-3">
              <div className="text-[10px] font-bold text-gray-600 uppercase tracking-wider">Issue New Weekly Code</div>

              {generatedCode && (
                <div className="flex items-center gap-3 p-4 bg-gray-50 border border-gray-200">
                  <div style={{
                    fontFamily: 'monospace', fontSize: '28px', fontWeight: '800',
                    letterSpacing: '0.3em', color: '#1A1A1A',
                    userSelect: showCode ? 'text' : 'none',
                    filter: showCode ? 'none' : 'blur(6px)',
                    transition: 'filter 200ms',
                  }}>
                    {generatedCode}
                  </div>
                  <button onClick={() => setShowCode(v => !v)} className="ml-2 text-gray-400 hover:text-gray-900 transition-colors" title={showCode ? 'Hide code' : 'Reveal code'}>
                    {showCode ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                  <div className="ml-auto text-[10px] text-orange-600 font-semibold uppercase tracking-wider">⚠ Not yet saved</div>
                </div>
              )}

              {tokenStatus2 && (
                <div className={`flex items-start gap-2 p-3 text-xs font-medium ${tokenStatus2.type === 'success' ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-800'}`}>
                  {tokenStatus2.type === 'success' ? <CheckCircle2 size={13} className="mt-0.5" /> : <AlertTriangle size={13} className="mt-0.5" />}
                  {tokenStatus2.text}
                  <button onClick={() => setTokenStatus2(null)} className="ml-auto"><X size={12} /></button>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <button onClick={generateNewCode} className="flex items-center gap-2 px-4 py-2 border border-gray-900 text-gray-900 text-[11px] font-bold uppercase tracking-wider hover:bg-gray-900 hover:text-white transition-colors">
                  <RefreshCw size={12} /> Generate Random Code
                </button>
                {generatedCode && (
                  <button onClick={applyNewCode} disabled={tokenSetting} className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-[11px] font-bold uppercase tracking-wider hover:bg-gray-700 transition-colors disabled:opacity-50">
                    {tokenSetting ? <><Loader2 size={12} className="animate-spin" /> Saving...</> : <><CheckCircle2 size={12} /> Activate This Code</>}
                  </button>
                )}
              </div>
              <p className="text-[10px] text-gray-400 leading-relaxed">
                The code is <strong>hashed with bcrypt</strong> before storage — the plaintext is never saved to the database. Distribute it securely (in-person or encrypted message). It expires automatically in 7 days.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab Switcher ────────────────────────────────────────────────────── */}
      <div className="border-b border-gray-200 flex gap-0">
        {[
          { key: 'list',   label: 'User Accounts', icon: <Users size={13} /> },
          { key: 'create', label: 'Create Account', icon: <UserPlus size={13} /> },
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
                  <option value="all">All Roles</option>
                  {Object.entries(ROLE_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
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
                  <th className="text-left px-4 py-3 text-[9px] font-bold text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-3 text-[9px] font-bold text-gray-400 uppercase tracking-wider hidden md:table-cell">Last Seen</th>
                  {canToggleUsers && (
                    <th className="text-right px-4 py-3 text-[9px] font-bold text-gray-400 uppercase tracking-wider">Access</th>
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
                  filteredList.map((u, idx) => {
                    const online    = isOnline(u.last_seen_at);
                    const active    = u.is_active !== false;
                    const isSelf    = u.id === user?.id;
                    const toggling  = togglingId === u.id;
                    const roleInfo  = ROLE_LABELS[u.role] || { label: u.role, color: '#737373', bg: '#F5F5F5' };

                    return (
                      <tr
                        key={u.id}
                        className={`border-b border-gray-100 transition-colors ${!active ? 'bg-gray-50 opacity-60' : 'hover:bg-gray-50'}`}
                      >
                        {/* Officer */}
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <div className="relative flex-shrink-0">
                              <div className="w-7 h-7 bg-gray-100 border border-gray-200 flex items-center justify-center text-[11px] font-bold text-gray-600 select-none uppercase">
                                {(u.username || u.id || '?')[0]}
                              </div>
                              {/* Online dot */}
                              <span
                                className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white"
                                style={{ background: online ? '#22C55E' : '#D1D5DB' }}
                                title={online ? 'Online' : 'Offline'}
                              />
                            </div>
                            <div>
                              <div className="font-semibold text-gray-900 text-[11px]">
                                {u.username || <span className="text-gray-400 italic text-[10px]">{u.id.slice(0, 8)}</span>}
                                {isSelf && <span className="ml-1.5 text-[9px] font-bold text-gray-400 bg-gray-100 px-1 py-0.5">(YOU)</span>}
                              </div>
                              <div className="text-[9px] text-gray-400 font-mono">{u.username ? `${u.username}@tps.idtl` : u.email || '—'}</div>
                            </div>
                          </div>
                        </td>

                        {/* Role */}
                        <td className="px-4 py-3.5 hidden sm:table-cell">
                          <span
                            className="inline-flex items-center px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider border"
                            style={{ color: roleInfo.color, background: roleInfo.bg, borderColor: roleInfo.color + '30' }}
                          >
                            {roleInfo.label}
                          </span>
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
                            <span
                              className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                              style={{ background: online ? '#22C55E' : '#D1D5DB' }}
                            />
                            <span className={`text-[10px] font-medium ${online ? 'text-green-700' : 'text-gray-400'}`}>
                              {online ? 'Online' : formatLastSeen(u.last_seen_at)}
                            </span>
                          </div>
                        </td>

                        {/* Toggle */}
                        {canToggleUsers && (
                          <td className="px-4 py-3.5 text-right">
                            {isSelf ? (
                              <span className="text-[9px] text-gray-300 italic">—</span>
                            ) : (
                              <button
                                onClick={() => toggleUserActive(u)}
                                disabled={toggling}
                                title={active ? 'Disable this account' : 'Enable this account'}
                                className={`flex items-center gap-1.5 ml-auto text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 border transition-all ${
                                  active
                                    ? 'border-red-200 text-red-600 hover:bg-red-50 bg-white'
                                    : 'border-green-200 text-green-700 hover:bg-green-50 bg-white'
                                } disabled:opacity-40`}
                              >
                                {toggling ? (
                                  <Loader2 size={11} className="animate-spin" />
                                ) : active ? (
                                  <><ToggleRight size={13} /> Disable</>
                                ) : (
                                  <><ToggleLeft size={13} /> Enable</>
                                )}
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
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

            <div className="border border-gray-200 p-6">
              <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-4">System Roles</h3>
              <div className="space-y-4">
                {[
                  ['Level 1: Field Staff',      'Standard data entry and identity verification capabilities.'],
                  ['Level 2: Operations',        'Access to bulk upload and data correction tools.'],
                  ['Level 3: Regional Admin',    'Full access to statistics and reports for assigned districts.'],
                  ['Level 4: System Admin',      'Master control over database schema and user management.'],
                ].map(([title, desc]) => (
                  <div key={title}>
                    <div className="text-[10px] font-bold text-gray-900 uppercase mb-1">{title}</div>
                    <div className="text-[11px] text-gray-500">{desc}</div>
                  </div>
                ))}
              </div>
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
                      <option value="field">Field Staff</option>
                      <option value="ops">Operations</option>
                      <option value="regional">Regional Admin</option>
                      <option value="system">System Admin</option>
                    </select>
                  </div>

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
