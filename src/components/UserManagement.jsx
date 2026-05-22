import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { UserPlus, Shield, User, Key, Hash, Loader2, CheckCircle2, AlertTriangle, X, RefreshCw, Lock, Clock, ShieldAlert, Eye, EyeOff } from 'lucide-react';

const UserManagement = ({ user }) => {
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    displayName: '',
    role: 'field'
  });
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null); // { type: 'success' | 'error', text: '' }

  // ── Weekly Access Token ─────────────────────────────────────────────
  const [tokenStatus, setTokenStatus] = useState(null);
  const [tokenLoading, setTokenLoading] = useState(false);
  const [tokenStatus2, setTokenStatus2] = useState(null); // { type, text }
  const [generatedCode, setGeneratedCode] = useState('');
  const [showCode, setShowCode] = useState(false);
  const [tokenSetting, setTokenSetting] = useState(false);

  const canManageToken = user?.role === 'system' || user?.role === 'master' || user?.role === 'admin';

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

  useEffect(() => { loadTokenStatus(); }, [loadTokenStatus]);

  const generateNewCode = () => {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    setGeneratedCode(code);
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
      setTokenStatus2({ type: 'success', text: `New 6-digit code activated. Expires in 7 days. Distribute securely.` });
      setGeneratedCode('');
      setShowCode(false);
      await loadTokenStatus();
    } catch (err) {
      setTokenStatus2({ type: 'error', text: err.message || 'Failed to set access token.' });
    } finally {
      setTokenSetting(false);
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setStatus(null);

    try {
      // Invoke the Supabase Edge Function
      const { data, error } = await supabase.functions.invoke('create-user', {
        body: formData,
      });

      if (error) throw error;

      setStatus({ 
        type: 'success', 
        text: 'User account created successfully. The officer can now log in using their credentials.' 
      });
      
      // Reset form
      setFormData({
        username: '',
        password: '',
        displayName: '',
        role: 'field'
      });
    } catch (err) {
      console.error('User creation failed:', err);
      setStatus({ 
        type: 'error', 
        text: err.message || 'An unexpected error occurred during user creation.' 
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-8 p-6 sm:p-8 xl:p-10 max-w-4xl xl:max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <h2 style={{ fontSize: '20px', margin: '0 0 8px 0', color: '#1A1A1A', fontWeight: '500', letterSpacing: '0.02em' }}>
          USER MANAGEMENT
        </h2>
        <p style={{ margin: 0, color: '#737373', fontSize: '12px' }}>
          Provision new user accounts for field officers and administrative staff.
        </p>
      </div>

      {/* ── Weekly Access Token Panel ── */}
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

            {/* Current token status */}
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
                  <div className="text-[10px] text-gray-400 mt-1">
                    Last set: {new Date(tokenStatus.created_at).toLocaleDateString('en-GB')}
                  </div>
                </div>
              </div>
            ) : tokenLoading ? (
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <Loader2 size={13} className="animate-spin" /> Loading token status...
              </div>
            ) : (
              <div className="text-xs text-gray-400 italic">No token configured yet.</div>
            )}

            {/* Generate + Apply */}
            <div className="border-t border-gray-100 pt-5 space-y-3">
              <div className="text-[10px] font-bold text-gray-600 uppercase tracking-wider">Issue New Weekly Code</div>

              {/* Generated code preview */}
              {generatedCode && (
                <div className="flex items-center gap-3 p-4 bg-gray-50 border border-gray-200">
                  <div
                    style={{
                      fontFamily: 'monospace',
                      fontSize: '28px',
                      fontWeight: '800',
                      letterSpacing: '0.3em',
                      color: '#1A1A1A',
                      userSelect: showCode ? 'text' : 'none',
                      filter: showCode ? 'none' : 'blur(6px)',
                      transition: 'filter 200ms',
                    }}
                  >
                    {generatedCode}
                  </div>
                  <button
                    onClick={() => setShowCode(v => !v)}
                    className="ml-2 text-gray-400 hover:text-gray-900 transition-colors"
                    title={showCode ? 'Hide code' : 'Reveal code'}
                  >
                    {showCode ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                  <div className="ml-auto text-[10px] text-orange-600 font-semibold uppercase tracking-wider">⚠ Not yet saved</div>
                </div>
              )}

              {/* Status messages */}
              {tokenStatus2 && (
                <div className={`flex items-start gap-2 p-3 text-xs font-medium ${
                  tokenStatus2.type === 'success' ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-800'
                }`}>
                  {tokenStatus2.type === 'success' ? <CheckCircle2 size={13} className="mt-0.5" /> : <AlertTriangle size={13} className="mt-0.5" />}
                  {tokenStatus2.text}
                  <button onClick={() => setTokenStatus2(null)} className="ml-auto"><X size={12} /></button>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={generateNewCode}
                  className="flex items-center gap-2 px-4 py-2 border border-gray-900 text-gray-900 text-[11px] font-bold uppercase tracking-wider hover:bg-gray-900 hover:text-white transition-colors"
                >
                  <RefreshCw size={12} /> Generate Random Code
                </button>
                {generatedCode && (
                  <button
                    onClick={applyNewCode}
                    disabled={tokenSetting}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-[11px] font-bold uppercase tracking-wider hover:bg-gray-700 transition-colors disabled:opacity-50"
                  >
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

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 xl:gap-10">
        {/* Information Panel */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-gray-50 border border-gray-200 p-6">
            <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Shield size={14} /> Security Protocols
            </h3>
            <ul className="space-y-3 text-xs text-gray-600 leading-relaxed">
              <li className="flex gap-2">
                <span className="text-gray-900 font-bold">•</span>
                Users are created within the <strong>tps.idtl</strong> internal domain.
              </li>
              <li className="flex gap-2">
                <span className="text-gray-900 font-bold">•</span>
                PIN codes must be at least 6 characters for field operations.
              </li>
              <li className="flex gap-2">
                <span className="text-gray-900 font-bold">•</span>
                Account access is monitored via the central audit system.
              </li>
              <li className="flex gap-2">
                <span className="text-gray-900 font-bold">•</span>
                Role changes must be audited by a System Administrator.
              </li>
            </ul>
          </div>

          <div className="border border-gray-200 p-6">
            <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-4">System Roles</h3>
            <div className="space-y-4">
              <div>
                <div className="text-[10px] font-bold text-gray-900 uppercase mb-1">Level 1: Field Staff</div>
                <div className="text-[11px] text-gray-500">Standard data entry and identity verification capabilities.</div>
              </div>
              <div>
                <div className="text-[10px] font-bold text-gray-900 uppercase mb-1">Level 2: Operations</div>
                <div className="text-[11px] text-gray-500">Access to bulk upload and data correction tools.</div>
              </div>
              <div>
                <div className="text-[10px] font-bold text-gray-900 uppercase mb-1">Level 3: Regional Admin</div>
                <div className="text-[11px] text-gray-500">Full access to statistics and reports for assigned districts.</div>
              </div>
              <div>
                <div className="text-[10px] font-bold text-gray-900 uppercase mb-1">Level 4: System Admin</div>
                <div className="text-[11px] text-gray-500">Master control over database schema and user management.</div>
              </div>
            </div>
          </div>
        </div>

        {/* Creation Form */}
        <div className="lg:col-span-3">
          <div className="bg-white border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-xs font-semibold text-gray-900 flex items-center gap-2 uppercase tracking-widest">
                <UserPlus size={14} className="text-gray-900" /> 
                Create Internal Account
              </h3>
            </div>
            
            <div className="p-6">
              {status && (
                <div className={`mb-6 p-4 flex items-start gap-3 ${
                  status.type === 'success' ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-800'
                }`}>
                  {status.type === 'success' ? <CheckCircle2 size={16} className="mt-0.5" /> : <AlertTriangle size={16} className="mt-0.5" />}
                  <div className="text-xs font-medium leading-normal">{status.text}</div>
                  <button onClick={() => setStatus(null)} className="ml-auto">
                    <X size={14} />
                  </button>
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
                      type="text" 
                      name="username" 
                      required
                      value={formData.username}
                      onChange={handleChange}
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
                      type="password" 
                      name="password" 
                      required
                      value={formData.password}
                      onChange={handleChange}
                      className="w-full px-3 py-2 bg-white border border-gray-200 focus:outline-none focus:border-gray-900 transition-colors text-sm"
                      placeholder="••••••••"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-600 mb-1 uppercase tracking-wider">Display Name (Myanmar/English)</label>
                  <input 
                    type="text" 
                    name="displayName" 
                    required
                    value={formData.displayName}
                    onChange={handleChange}
                    className="w-full px-3 py-2 bg-white border border-gray-200 focus:outline-none focus:border-gray-900 transition-colors text-sm"
                    placeholder="e.g. ဦးကျော်ဇေယျ"
                  />
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-600 mb-1 uppercase tracking-wider">System Role</label>
                    <select
                      name="role"
                      value={formData.role}
                      onChange={handleChange}
                      className="w-full px-3 py-2.5 bg-white border border-gray-200 focus:outline-none focus:border-gray-900 transition-colors text-sm appearance-none cursor-pointer"
                    >
                      <option value="field">Field Staff</option>
                      <option value="ops">Operations</option>
                      <option value="regional">Regional Admin</option>
                      <option value="system">System Admin</option>
                    </select>
                  </div>
                </div>

                <div className="pt-4">
                  <button 
                    type="submit" 
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 bg-gray-900 hover:bg-white hover:text-gray-900 border border-gray-900 text-white px-6 py-3 rounded-none font-bold transition-colors text-xs uppercase tracking-[0.2em] disabled:opacity-50"
                  >
                    {loading ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        Provisioning...
                      </>
                    ) : (
                      'Create User Account'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserManagement;
