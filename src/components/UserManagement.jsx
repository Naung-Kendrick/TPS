import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { UserPlus, Shield, User, Key, Hash, Loader2, CheckCircle2, AlertTriangle, X } from 'lucide-react';

const UserManagement = () => {
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    displayName: '',
    role: 'field'
  });
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null); // { type: 'success' | 'error', text: '' }

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
    <div className="flex flex-col gap-8 p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h2 style={{ fontSize: '20px', margin: '0 0 8px 0', color: '#1A1A1A', fontWeight: '500', letterSpacing: '0.02em' }}>
          USER MANAGEMENT
        </h2>
        <p style={{ margin: 0, color: '#737373', fontSize: '12px' }}>
          Provision new user accounts for field officers and administrative staff.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
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
