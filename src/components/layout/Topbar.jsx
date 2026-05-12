import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, Bell, ChevronDown, X, CheckCircle2, Upload, ScanLine, Wifi, WifiOff, RefreshCw, Info, AlertTriangle, AlertCircle } from 'lucide-react';
import flag from "../../assets/taang_flag.jpg";
import { getNotifications, getUnreadCount, markAllRead, clearAll, NOTIF_TYPES } from '../../lib/notifications';

const TYPE_META = {
  [NOTIF_TYPES.SYNC]:         { icon: RefreshCw,    color: '#2563EB', bg: '#EFF6FF' },
  [NOTIF_TYPES.UPLOAD]:       { icon: Upload,        color: '#16A34A', bg: '#F0FDF4' },
  [NOTIF_TYPES.VERIFICATION]: { icon: CheckCircle2,  color: '#1A1A1A', bg: '#F3F4F6' },
  [NOTIF_TYPES.ONLINE]:       { icon: Wifi,          color: '#16A34A', bg: '#F0FDF4' },
  [NOTIF_TYPES.OFFLINE]:      { icon: WifiOff,       color: '#DC2626', bg: '#FEF2F2' },
  [NOTIF_TYPES.WARNING]:      { icon: AlertTriangle, color: '#D97706', bg: '#FFFBEB' },
  [NOTIF_TYPES.ERROR]:        { icon: AlertCircle,   color: '#DC2626', bg: '#FEF2F2' },
  [NOTIF_TYPES.INFO]:         { icon: Info,          color: '#737373', bg: '#F9FAFB' },
};

function timeAgo(iso) {
  const diff = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

const Topbar = () => {
  const [panelOpen, setPanelOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread] = useState(0);
  const panelRef = useRef(null);

  const refresh = useCallback(() => {
    setNotifications(getNotifications());
    setUnread(getUnreadCount());
  }, []);

  useEffect(() => {
    refresh();
    window.addEventListener('tps:notifications', refresh);
    return () => window.removeEventListener('tps:notifications', refresh);
  }, [refresh]);

  // Close panel on outside click
  useEffect(() => {
    if (!panelOpen) return;
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setPanelOpen(false);
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => { document.removeEventListener('mousedown', handler); document.removeEventListener('touchstart', handler); };
  }, [panelOpen]);

  const handleBellClick = () => {
    setPanelOpen(v => !v);
    if (!panelOpen) { markAllRead(); }
  };

  const handleClear = () => { clearAll(); setPanelOpen(false); };

  return (
    <header style={{
      height: '50px',
      backgroundColor: '#FFFFFF',
      borderBottom: '1px solid #E5E7EB',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 24px',
      position: 'sticky',
      top: 0,
      zIndex: 200,
      flexShrink: 0,
    }}>

      {/* ── Left: breadcrumb style title ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <img src={flag} alt="Ta'ang Flag" style={{ height: '16px', border: '1px solid #E5E7EB', objectFit: 'cover' }} />
        <span style={{ fontSize: '12px', fontWeight: '600', color: '#1A1A1A', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
          TLFUG Immigration
        </span>
        <span style={{ fontSize: '12px', color: '#737373' }}>|</span>
        <span style={{ fontSize: '12px', color: '#737373' }}>
          တအာင်းပြည်လွတ်မြောက်ရေးတပ်မတော်
        </span>
      </div>

      {/* ── Right ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>

        {/* Search */}
        <div style={{ position: 'relative' }}>
          <div style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#737373', pointerEvents: 'none' }}>
            <Search size={12} />
          </div>
          <input
            type="text"
            placeholder="SEARCH..."
            style={{ width: '200px', padding: '6px 10px 6px 28px', borderRadius: '0px', border: '1px solid #E5E7EB', backgroundColor: '#FAFAFA', fontSize: '11px', color: '#1A1A1A', outline: 'none', letterSpacing: '0.05em' }}
          />
        </div>

        {/* Bell + panel */}
        <div ref={panelRef} style={{ position: 'relative' }}>
          <button
            onClick={handleBellClick}
            style={{ background: panelOpen ? '#F3F4F6' : 'none', border: 'none', padding: '6px', color: '#1A1A1A', cursor: 'pointer', display: 'flex', alignItems: 'center', position: 'relative' }}
          >
            <Bell size={16} />
            {unread > 0 && (
              <span style={{
                position: 'absolute', top: 2, right: 2,
                minWidth: '14px', height: '14px',
                backgroundColor: '#DC2626', color: '#fff',
                borderRadius: '50%', fontSize: '8px', fontWeight: '700',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '0 2px', lineHeight: 1,
              }}>{unread > 9 ? '9+' : unread}</span>
            )}
          </button>

          {/* Dropdown panel */}
          {panelOpen && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 8px)', right: 0,
              width: '340px', maxHeight: '480px',
              backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB',
              boxShadow: '0 4px 24px rgba(0,0,0,0.10)',
              display: 'flex', flexDirection: 'column',
              zIndex: 300,
            }}>
              {/* Panel header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid #E5E7EB', backgroundColor: '#FAFAFA', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Bell size={13} color="#1A1A1A" />
                  <span style={{ fontSize: '11px', fontWeight: '700', color: '#1A1A1A', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Notifications</span>
                  {notifications.length > 0 && (
                    <span style={{ fontSize: '9px', backgroundColor: '#E5E7EB', color: '#737373', padding: '1px 5px', fontWeight: '600' }}>{notifications.length}</span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {notifications.length > 0 && (
                    <button onClick={handleClear} style={{ background: 'none', border: 'none', fontSize: '9px', color: '#737373', cursor: 'pointer', padding: '2px 6px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                      Clear all
                    </button>
                  )}
                  <button onClick={() => setPanelOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: '#737373', display: 'flex' }}>
                    <X size={14} />
                  </button>
                </div>
              </div>

              {/* Notification list */}
              <div style={{ overflowY: 'auto', flex: 1 }}>
                {notifications.length === 0 ? (
                  <div style={{ padding: '40px 20px', textAlign: 'center', color: '#9CA3AF', fontSize: '11px' }}>
                    <Bell size={24} style={{ margin: '0 auto 8px', opacity: 0.3, display: 'block' }} />
                    No notifications yet
                  </div>
                ) : (
                  notifications.map((n) => {
                    const meta = TYPE_META[n.type] || TYPE_META[NOTIF_TYPES.INFO];
                    const Icon = meta.icon;
                    return (
                      <div key={n.id} style={{
                        display: 'flex', gap: '10px', padding: '10px 14px',
                        borderBottom: '1px solid #F3F4F6',
                        backgroundColor: n.read ? '#FFFFFF' : '#FAFAFA',
                      }}>
                        <div style={{ width: '28px', height: '28px', backgroundColor: meta.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <Icon size={13} color={meta.color} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '11px', fontWeight: '600', color: '#1A1A1A', marginBottom: '2px' }}>{n.title}</div>
                          {n.message && <div style={{ fontSize: '10px', color: '#737373', lineHeight: 1.4, wordBreak: 'break-word' }}>{n.message}</div>}
                        </div>
                        <span style={{ fontSize: '9px', color: '#9CA3AF', whiteSpace: 'nowrap', marginTop: '2px', flexShrink: 0 }}>{timeAgo(n.timestamp)}</span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* Divider */}
        <div style={{ width: '1px', height: '20px', backgroundColor: '#E5E7EB', margin: '0 4px' }} />

        {/* Profile */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: '6px 8px', transition: 'background 0.1s' }}
          onMouseOver={e => e.currentTarget.style.backgroundColor = '#F3F4F6'}
          onMouseOut={e => e.currentTarget.style.backgroundColor = 'transparent'}
        >
          <div style={{ width: '24px', height: '24px', backgroundColor: '#1A1A1A', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: '600', flexShrink: 0 }}>UM</div>
          <span style={{ fontSize: '12px', fontWeight: '500', color: '#1A1A1A' }}>U MYO MIN</span>
          <ChevronDown size={12} color="#737373" />
        </div>

      </div>
    </header>
  );
};

export default Topbar;
