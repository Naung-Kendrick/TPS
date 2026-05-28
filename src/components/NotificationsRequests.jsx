import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import {
  Bell, Trash2, CheckCircle2, AlertTriangle, AlertCircle, Loader2, RefreshCw,
  Wifi, WifiOff, Upload, Info, FileText, Check, ShieldAlert
} from 'lucide-react';
import {
  getNotifications,
  markAllRead,
  markRead,
  clearAll,
  NOTIF_TYPES,
  playRequestChime,
  playResolveChime,
  playMarkReadChime
} from '../lib/notifications';
import { getProfileType } from '../lib/roleHelper';

const TYPE_META = {
  [NOTIF_TYPES.SYNC]:         { icon: RefreshCw,    color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE' },
  [NOTIF_TYPES.UPLOAD]:       { icon: Upload,        color: '#16A34A', bg: '#F0FDF4', border: '#A7F3D0' },
  [NOTIF_TYPES.VERIFICATION]: { icon: CheckCircle2,  color: '#059669', bg: '#ECFDF5', border: '#A7F3D0' },
  [NOTIF_TYPES.ONLINE]:       { icon: Wifi,          color: '#16A34A', bg: '#F0FDF4', border: '#A7F3D0' },
  [NOTIF_TYPES.OFFLINE]:      { icon: WifiOff,       color: '#DC2626', bg: '#FEF2F2', border: '#FECACA' },
  [NOTIF_TYPES.WARNING]:      { icon: AlertTriangle, color: '#D97706', bg: '#FFFBEB', border: '#FDE68A' },
  [NOTIF_TYPES.ERROR]:        { icon: AlertCircle,   color: '#DC2626', bg: '#FEF2F2', border: '#FECACA' },
  [NOTIF_TYPES.INFO]:         { icon: Info,          color: '#4B5563', bg: '#F3F4F6', border: '#E5E7EB' },
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

const NotificationsRequests = ({ user }) => {
  const uRole = user?.role || user?.profile?.role || 'field';
  const isAdminLevel = uRole === 'system' || uRole === 'master' || uRole === 'admin' || uRole === 'regional';

  const [activeTab, setActiveTab] = useState('alerts');
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // ── Print/Export requests states ──────────────────────────────────────────
  const [requests, setRequests] = useState([]);
  const [reqLoading, setReqLoading] = useState(false);

  // ── Fetch local alerts ────────────────────────────────────────────────────
  const loadAlerts = useCallback(() => {
    const list = getNotifications();
    setNotifications(list);
    setUnreadCount(list.filter(n => !n.read).length);
  }, []);

  useEffect(() => {
    loadAlerts();
    window.addEventListener('tps:notifications', loadAlerts);
    return () => window.removeEventListener('tps:notifications', loadAlerts);
  }, [loadAlerts]);

  // ── Print/Export loader & resolver ────────────────────────────────────────
  const loadRequests = useCallback(async () => {
    if (!isAdminLevel) return;
    setReqLoading(true);
    try {
      const { data, error } = await supabase
        .from('print_export_requests')
        .select('*')
        .eq('status', 'pending')
        .order('requested_at', { ascending: false });
      
      if (error) throw error;
      setRequests(data || []);
    } catch (err) {
      console.error('Failed to load authorization requests:', err);
    } finally {
      setReqLoading(false);
    }
  }, [isAdminLevel]);

  const resolveRequest = async (id) => {
    try {
      const { error } = await supabase
        .from('print_export_requests')
        .update({
          status: 'resolved',
          resolved_by: user?.id,
          resolved_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;
      setRequests(prev => prev.filter(r => r.id !== id));
      playResolveChime();
      
      // Dispatch a notification
      window.dispatchEvent(new CustomEvent('tps:notifications'));
    } catch (err) {
      alert('Failed to resolve request: ' + err.message);
    }
  };

  // Realtime Supabase Subscription for print/export requests
  useEffect(() => {
    if (!isAdminLevel) return;
    loadRequests();

    const channel = supabase
      .channel('notifications_requests_realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'print_export_requests' }, () => {
        loadRequests();
        playRequestChime();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'print_export_requests' }, () => {
        loadRequests();
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'print_export_requests' }, () => {
        loadRequests();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAdminLevel, loadRequests]);

  const handleMarkAllRead = () => {
    markAllRead();
    playMarkReadChime();
  };

  const handleClearAll = () => {
    clearAll();
    playMarkReadChime();
  };

  const handleMarkRead = (id) => {
    markRead(id);
    playMarkReadChime();
  };

  return (
    <div className="flex flex-col gap-8 p-6 sm:p-8 xl:p-10 max-w-7xl xl:max-w-[1440px] mx-auto">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div>
        <h2 style={{ fontSize: '20px', margin: '0 0 8px 0', color: '#1A1A1A', fontWeight: '500', letterSpacing: '0.02em' }}>
          NOTIFICATIONS & REQUESTS
        </h2>
        <p style={{ margin: 0, color: '#737373', fontSize: '12px' }}>
          Monitor system connection events, upload alerts, and approve viewer authorizations.
        </p>
      </div>

      {/* ── Tab Switcher ────────────────────────────────────────────────────── */}
      <div className="border-b border-gray-200 flex gap-0">
        <button
          onClick={() => setActiveTab('alerts')}
          className={`flex items-center gap-2 px-5 py-3 text-[11px] font-bold uppercase tracking-wider border-b-2 transition-colors ${
            activeTab === 'alerts'
              ? 'border-gray-900 text-gray-900'
              : 'border-transparent text-gray-400 hover:text-gray-700'
          }`}
        >
          <Bell size={13} /> System Alerts & Alerts
          {unreadCount > 0 && (
            <span className="ml-1 px-1.5 py-0.5 text-[9px] font-bold rounded-full bg-red-500 text-white">
              {unreadCount}
            </span>
          )}
        </button>

        {isAdminLevel && (
          <button
            onClick={() => setActiveTab('requests')}
            className={`flex items-center gap-2 px-5 py-3 text-[11px] font-bold uppercase tracking-wider border-b-2 transition-colors ${
              activeTab === 'requests'
                ? 'border-gray-900 text-gray-900'
                : 'border-transparent text-gray-400 hover:text-gray-700'
            }`}
          >
            <ShieldAlert size={13} /> Pending Approvals
            {requests.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-[9px] font-bold rounded-full bg-amber-500 text-white animate-pulse">
                {requests.length}
              </span>
            )}
          </button>
        )}
      </div>

      {/* ── SYSTEM ALERTS TAB ───────────────────────────────────────────────── */}
      {activeTab === 'alerts' && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2 items-center justify-between">
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
              {notifications.length} Total Logs ({unreadCount} Unread)
            </div>
            
            {notifications.length > 0 && (
              <div className="flex gap-2">
                <button
                  onClick={handleMarkAllRead}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-[10px] font-bold uppercase tracking-wider text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  <Check size={11} /> Mark All Read
                </button>
                <button
                  onClick={handleClearAll}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-red-200 text-[10px] font-bold uppercase tracking-wider text-red-600 hover:bg-red-50 transition-colors"
                >
                  <Trash2 size={11} /> Clear All Logs
                </button>
              </div>
            )}
          </div>

          {notifications.length === 0 ? (
            <div className="border border-gray-200 bg-white text-center py-16">
              <CheckCircle2 size={36} className="text-gray-300 mx-auto mb-3" />
              <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider">System log is clean</h4>
              <p className="text-[11px] text-gray-400 mt-1">No warnings, connection logs, or synchronization events reported yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {notifications.map((n) => {
                const meta = TYPE_META[n.type] || TYPE_META[NOTIF_TYPES.INFO];
                const Icon = meta.icon;
                return (
                  <div
                    key={n.id}
                    style={{
                      borderLeft: `4px solid ${meta.color}`,
                      borderColor: n.read ? '#E5E7EB' : meta.border,
                      borderLeftColor: meta.color,
                      backgroundColor: n.read ? '#FFFFFF' : `${meta.bg}50`
                    }}
                    className={`border p-4 flex gap-4 transition-all ${n.read ? 'bg-white opacity-80' : 'bg-white shadow-sm'}`}
                  >
                    <div
                      style={{ backgroundColor: meta.bg }}
                      className="w-8 h-8 rounded-none flex items-center justify-center flex-shrink-0"
                    >
                      <Icon size={14} color={meta.color} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-[11px] font-bold text-gray-900">{n.title}</span>
                        {!n.read && (
                          <span className="px-1.5 py-0.2 text-[8px] font-bold uppercase bg-red-100 text-red-700 tracking-wider">
                            New
                          </span>
                        )}
                        <span className="text-[9px] text-gray-400 font-mono ml-auto">
                          {formatLastSeen(n.timestamp)}
                        </span>
                      </div>
                      {n.message && (
                        <p className="text-[11px] text-gray-500 leading-relaxed max-w-4xl">
                          {n.message}
                        </p>
                      )}
                    </div>

                    {!n.read && (
                      <button
                        onClick={() => handleMarkRead(n.id)}
                        className="text-[9px] font-bold uppercase text-gray-400 hover:text-gray-900 border border-gray-200 hover:border-gray-900 px-2 py-1 h-fit transition-colors align-self-center self-center"
                      >
                        Read
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── PENDING APPROVALS TAB ───────────────────────────────────────────── */}
      {activeTab === 'requests' && isAdminLevel && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-[13px] font-bold text-gray-900 uppercase tracking-wider">Pending Print / Export Requests</h3>
              <p className="text-[10px] text-gray-400 mt-0.5">Viewer-level officers who need to print or export data will appear here.</p>
            </div>
            <button onClick={loadRequests} disabled={reqLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-[10px] font-bold uppercase tracking-wider text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50">
              <RefreshCw size={11} className={reqLoading ? 'animate-spin' : ''} /> Refresh
            </button>
          </div>

          {reqLoading ? (
            <div className="flex items-center gap-2 text-[11px] text-gray-400 py-8 justify-center">
              <Loader2 size={14} className="animate-spin" /> Loading requests...
            </div>
          ) : requests.length === 0 ? (
            <div className="border border-gray-200 bg-white text-center py-16">
              <CheckCircle2 size={36} className="text-gray-300 mx-auto mb-3" />
              <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider">All Caught Up</h4>
              <p className="text-[11px] text-gray-400 mt-1">No pending viewer export authorisations require your signature.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {requests.map(r => {
                const pageName = r.page === 'statistics' ? 'Population Statistics' : 'Demographic Dashboard';
                const typeLabel = r.export_type === 'print' ? 'Print (Legal)' : 'Export Excel';
                const f = r.filters || {};
                const filterStr = [
                  f.district  && `District: ${f.district}`,
                  f.township  && `Township: ${f.township}`,
                  f.ward      && `Ward: ${f.ward}`,
                  f.group     && `Group: ${f.group}`,
                  f.village   && `Village: ${f.village}`,
                ].filter(Boolean).join(' › ') || 'All data (no filter selected)';

                const requesterProfile = getProfileType(f._role || 'field', f._level || 'viewer');

                return (
                  <div key={r.id} className="border border-amber-200 bg-amber-50 p-4 flex flex-col sm:flex-row sm:items-start gap-4 shadow-sm"
                    style={{ borderLeft: `4px solid ${requesterProfile.color}` }}>
                    <div className="flex-grow space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[11px] font-bold text-gray-900">{r.requester_name || 'Unknown Officer'}</span>
                        <span className="text-[9px] font-bold px-2 py-0.5 uppercase border"
                          style={{
                            color: requesterProfile.color,
                            backgroundColor: requesterProfile.bg,
                            borderColor: requesterProfile.border
                          }}>
                          {requesterProfile.typicalPerson}
                        </span>
                        <span className="text-[9px] text-gray-400 font-mono">
                          {formatLastSeen(r.requested_at)}
                        </span>
                      </div>
                      <div className="text-[11px] text-gray-700">
                        Requests to **{typeLabel}** on **{pageName}**
                      </div>
                      <div className="text-[10px] text-gray-500 font-mono bg-white border border-amber-100 px-2.5 py-1 inline-block">
                        {filterStr}
                      </div>
                    </div>
                    
                    <button
                      onClick={() => resolveRequest(r.id)}
                      className="flex items-center gap-1.5 px-4 py-2 bg-gray-900 text-white text-[10px] font-bold uppercase tracking-wider hover:bg-gray-700 transition-colors self-start sm:self-auto whitespace-nowrap"
                    >
                      <CheckCircle2 size={12} /> Approve & Resolve
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationsRequests;
