import React, { useState, useEffect, useRef } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Users, UserPlus, LineChart, PieChart, FileText, Settings, Upload, ScanLine, Menu, X, MoreHorizontal, LogOut, CircleUserRound, UserCheck, Database } from 'lucide-react';
import logo from '../../assets/fonts/IDTL_logo.png';
import { getProfileType } from '../../lib/roleHelper';
import { getUnreadCount } from '../../lib/notifications';
import { Bell } from 'lucide-react';

const Sidebar = ({ user, onLogout }) => {
  const [open, setOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const moreSheetRef = useRef(null);
  const touchStartX = useRef(null);
  const touchStartY = useRef(null);

  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    setUnreadCount(getUnreadCount());
    const handleNotif = () => setUnreadCount(getUnreadCount());
    window.addEventListener('tps:notifications', handleNotif);
    return () => window.removeEventListener('tps:notifications', handleNotif);
  }, []);



  // Close drawer/more on route change (mobile)
  useEffect(() => { setOpen(false); setMoreOpen(false); }, [location.pathname]);

  // Close drawer on wide screen resize
  useEffect(() => {
    const handler = () => { if (window.innerWidth >= 768) { setOpen(false); setMoreOpen(false); } };
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  // Swipe gestures: swipe left to close drawer; swipe right from left edge to open
  useEffect(() => {
    const onTouchStart = (e) => {
      touchStartX.current = e.touches[0].clientX;
      touchStartY.current = e.touches[0].clientY;
    };
    const onTouchEnd = (e) => {
      if (touchStartX.current === null) return;
      const dx = e.changedTouches[0].clientX - touchStartX.current;
      const dy = Math.abs(e.changedTouches[0].clientY - touchStartY.current);
      // Only treat as horizontal swipe if horizontal movement dominates
      if (dy > Math.abs(dx) * 0.8) { touchStartX.current = null; return; }
      if (open && dx < -50) {
        // Swipe left anywhere → close drawer
        setOpen(false);
      } else if (!open && dx > 50 && touchStartX.current < 30) {
        // Swipe right from left edge (within 30px) → open drawer
        setOpen(true);
      }
      touchStartX.current = null;
    };
    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      document.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchend', onTouchEnd);
    };
  }, [open]);

  // Close "More" sheet when tapping outside
  useEffect(() => {
    if (!moreOpen) return;
    const handler = (e) => {
      if (moreSheetRef.current && !moreSheetRef.current.contains(e.target)) setMoreOpen(false);
    };
    document.addEventListener('touchstart', handler);
    document.addEventListener('mousedown', handler);
    return () => { document.removeEventListener('touchstart', handler); document.removeEventListener('mousedown', handler); };
  }, [moreOpen]);

  const menuItems = [
    { id: 'verification',     path: '/verification',     label: 'Data Verification',      icon: UserCheck      },
    { id: 'upload',           path: '/upload',           label: 'Data Upload',            icon: Upload         },
    { id: 'scanner',          path: '/scanner',          label: 'ID Card Scanner',        icon: ScanLine       },
    { id: 'statistics',       path: '/statistics',       label: 'Population Statistics',  icon: LineChart      },
    { id: 'demographics',     path: '/demographics',     label: 'Demographic Dashboard',  icon: PieChart       },
    { id: 'registration',     path: '/registration',     label: 'Household Registration', icon: UserPlus       },
    { id: 'central-database', path: '/central-database', label: 'Central Database',       icon: Database       },
    { id: 'users',            path: '/users',            label: 'User Management',        icon: Users          },
    { id: 'notifications-requests', path: '/notifications-requests', label: 'Notifications & Requests', icon: Bell },
  ];

  // Role-based + access-level filtering
  const filteredMenuItems = menuItems.filter(item => {
    if (item.id === 'users') return user?.role === 'system' || user?.role === 'master';
    if (item.id === 'upload') return user?.role === 'system' || user?.role === 'master' || user?.role === 'admin' || user?.role === 'ops';
    if (item.id === 'central-database') return user?.access_level !== 'viewer' && user?.access_level !== 'sub_township';
    return true;
  });

  // Bottom nav: first 4 primary + "More" for the rest
  const primaryNav = filteredMenuItems.slice(0, 4);
  const moreNav = filteredMenuItems.slice(4);

  const SidebarContent = () => (
    <div style={{
      width: '240px', flexShrink: 0, backgroundColor: '#FFFFFF',
      borderRight: '1px solid #E5E7EB', display: 'flex', flexDirection: 'column',
      height: '100%', overflowY: 'auto',
      borderLeft: '3px solid #1A1A1A',
    }}>
      {/* Authority Header */}
      <div style={{
        padding: '14px 16px 12px',
        borderBottom: '1px solid #E5E7EB',
        backgroundColor: '#FAFAFA',
      }}>
        {/* Issuing body */}
        <div style={{ marginBottom: '10px' }}>
          <div style={{ fontSize: '10px', fontWeight: '600', color: '#1A1A1A', letterSpacing: '0.02em', lineHeight: 1.4, marginBottom: '2px' }}>
            တီုင်စေတ်မေန်းတိုအီး အဆိုးယကပီုန်တအာင်း
          </div>
          <div style={{ fontSize: '8px', fontWeight: '700', color: '#737373', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
            Ta'ang Land Immigration Dept.
          </div>
        </div>

        {/* Seal + title row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
          <div style={{
            width: '44px', height: '44px', flexShrink: 0,
            border: '2px solid #1A1A1A',
            backgroundColor: '#FFFFFF',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            overflow: 'hidden',
          }}>
            <img src={logo} alt="IDTL Seal" style={{ width: '90%', height: '90%', objectFit: 'contain' }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '14px', fontWeight: '800', color: '#1A1A1A', letterSpacing: '0.08em', textTransform: 'uppercase', lineHeight: 1 }}>TPS</div>
            <div style={{ fontSize: '9.5px', color: '#1A1A1A', fontWeight: '500', marginTop: '3px', lineHeight: 1.3 }}>Ta'ang Population{' '}System</div>
          </div>
          {/* Close button — mobile only */}
          <button onClick={() => setOpen(false)} style={{
            display: 'none', background: 'none', border: 'none', cursor: 'pointer', padding: '4px',
            color: '#737373', flexShrink: 0,
          }} className="sidebar-close-btn">
            <X size={18} />
          </button>
        </div>

        {/* Divider + system badge */}
        <div style={{ borderTop: '1px solid #E5E7EB', paddingTop: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '8px', color: '#737373', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Official System</span>
          <span style={{
            fontSize: '8px', fontWeight: '700', color: '#FFFFFF',
            backgroundColor: '#1A1A1A',
            padding: '2px 6px', letterSpacing: '0.06em', textTransform: 'uppercase',
          }}>IDTL · 2025</span>
        </div>
      </div>

      {/* Nav */}
      <div style={{ padding: '16px 8px', flex: 1 }}>
        <div style={{ fontSize: '10px', fontWeight: '600', color: '#737373', padding: '0 12px 8px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          Navigation
        </div>
        {filteredMenuItems.map(item => (
          <NavLink
            key={item.id}
            to={item.path}
            style={({ isActive }) => ({
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '9px 12px', marginBottom: '4px',
              border: isActive ? '1px solid #1A1A1A' : '1px solid transparent',
              backgroundColor: isActive ? '#FFFFFF' : 'transparent',
              color: '#1A1A1A', fontWeight: isActive ? '600' : '400',
              textDecoration: 'none', fontSize: '12px', letterSpacing: '0.02em', transition: 'background-color 100ms, color 100ms, border-color 100ms',
            })}
          >
            {({ isActive }) => (
              <>
                <item.icon size={14} strokeWidth={isActive ? 2 : 1.5} style={{ color: '#1A1A1A', flexShrink: 0 }} />
                <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</span>
                {item.id === 'notifications-requests' && unreadCount > 0 && (
                  <span style={{
                    backgroundColor: '#DC2626',
                    color: '#FFFFFF',
                    fontSize: '9px',
                    fontWeight: '700',
                    padding: '1px 5px',
                    borderRadius: '10px',
                    lineHeight: 1,
                    marginLeft: 'auto',
                    flexShrink: 0
                  }}>
                    {unreadCount}
                  </span>
                )}
              </>
            )}
          </NavLink>
        ))}
      </div>

      {/* User + Logout */}
      <div style={{ borderTop: '1px solid #E5E7EB', padding: '12px 10px 14px', backgroundColor: '#FAFAFA' }}>
        {/* Signed-in user card */}
        {(() => {
          const uRole = user?.role || user?.profile?.role || 'field';
          const uLevel = user?.access_level || user?.profile?.access_level || 'central';
          const prof = getProfileType(uRole, uLevel);
          const displayName = user?.profile?.display_name || user?.profile?.username || user?.username || 'Officer';
          const allowedDistricts = user?.allowed_districts || user?.profile?.allowed_districts || [];
          const allowedTownships = user?.allowed_townships || user?.profile?.allowed_townships || [];
          
          return (
            <div style={{
              padding: '10px 12px',
              backgroundColor: '#FFFFFF',
              border: `1px solid ${prof.border}`,
              borderLeft: `4px solid ${prof.color}`,
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
              marginBottom: '8px',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CircleUserRound size={13} style={{ color: prof.color, flexShrink: 0 }} />
                <span style={{ fontSize: '11px', fontWeight: '700', color: '#1A1A1A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {displayName.toUpperCase()}
                </span>
              </div>
              <div style={{ fontSize: '10px', fontWeight: '600', color: '#404040', letterSpacing: '0.01em' }}>
                {prof.typicalPerson}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px', marginTop: '2px' }}>
                <span style={{
                  fontSize: '8px',
                  fontWeight: '700',
                  color: prof.color,
                  backgroundColor: prof.bg,
                  padding: '1px 4px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.03em',
                  border: `1px solid ${prof.border}`
                }}>
                  {prof.roleName}
                </span>
                <span style={{
                  fontSize: '8px',
                  fontWeight: '700',
                  color: '#4B5563',
                  backgroundColor: '#F3F4F6',
                  padding: '1px 4px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.03em',
                  border: '1px solid #E5E7EB'
                }}>
                  {prof.accessLevel}
                </span>
              </div>

              {/* Allowed District/Township names */}
              {(uLevel === 'district' || uLevel === 'viewer') && allowedDistricts.length > 0 && (
                <div style={{
                  fontSize: '9.5px',
                  fontWeight: '600',
                  color: '#1E40AF',
                  backgroundColor: '#EFF6FF',
                  padding: '4px 6px',
                  border: '1px solid #BFDBFE',
                  marginTop: '4px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '2px'
                }}>
                  <span style={{ fontSize: '7.5px', fontWeight: '800', color: '#1D4ED8', textTransform: 'uppercase', letterSpacing: '0.02em' }}>Allowed Districts:</span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#1E3A8A' }}>
                    {allowedDistricts.join(', ')}
                  </span>
                </div>
              )}

              {(uLevel === 'township' || uLevel === 'sub_township') && allowedTownships.length > 0 && (
                <div style={{
                  fontSize: '9.5px',
                  fontWeight: '600',
                  color: '#3730A3',
                  backgroundColor: '#EEF2FF',
                  padding: '4px 6px',
                  border: '1px solid #C7D2FE',
                  marginTop: '4px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '2px'
                }}>
                  <span style={{ fontSize: '7.5px', fontWeight: '800', color: '#4338CA', textTransform: 'uppercase', letterSpacing: '0.02em' }}>Allowed Townships:</span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#312E81' }}>
                    {allowedTownships.join(', ')}
                  </span>
                </div>
              )}
            </div>
          );
        })()}
        {/* Sign Out button */}
        <button
          onClick={onLogout}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: '8px',
            padding: '8px 12px', background: 'none', border: '1px solid transparent',
            cursor: 'pointer', color: '#B71C1C', fontSize: '11px', fontWeight: '500',
            letterSpacing: '0.04em', textAlign: 'left',
            transition: 'border-color 100ms, background-color 100ms',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = '#B71C1C'; e.currentTarget.style.backgroundColor = '#FDF2F2'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.backgroundColor = 'transparent'; }}
        >
          <LogOut size={13} style={{ flexShrink: 0 }} />
          Sign Out
        </button>
      </div>

    </div>
  );

  return (
    <>
      {/* ── Mobile branding header ── */}
      <div className="mobile-topbar" style={{
        display: 'none', position: 'fixed', top: 0, left: 0, right: 0, zIndex: 900,
        backgroundColor: '#FAFAFA',
        borderBottom: '2px solid #1A1A1A',
        alignItems: 'center', justifyContent: 'flex-start', gap: '14px',
        padding: '0 16px', height: '56px',
      }}>
        {/* Menu Toggle Removed for better mobile header space - Navigation is handled by bottom bar and swipe gestures */}

        {/* Seal */}
        <div style={{
          width: '36px', height: '36px', flexShrink: 0,
          border: '1px solid #1A1A1A', backgroundColor: '#FFFFFF',
          display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
        }}>
          <img src={logo} alt="IDTL Seal" style={{ width: '88%', height: '88%', objectFit: 'contain' }} />
        </div>

        {/* Title block */}
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', minWidth: 0 }}>
          <span style={{ fontSize: '16px', fontWeight: '800', color: '#1A1A1A', letterSpacing: '0.07em', textTransform: 'uppercase', lineHeight: 1.1 }}>TPS</span>
          <span style={{ fontSize: '9px', fontWeight: '600', color: '#737373', letterSpacing: '0.05em', textTransform: 'uppercase', lineHeight: 1, whiteSpace: 'nowrap' }}>Ta'ang Population System</span>
        </div>

        {/* Official badge — pushed to right */}
        <span style={{
          marginLeft: 'auto', flexShrink: 0,
          fontSize: '9px', fontWeight: '700', color: '#FFFFFF',
          backgroundColor: '#1A1A1A',
          padding: '4px 8px', letterSpacing: '0.08em', textTransform: 'uppercase',
          whiteSpace: 'nowrap',
        }}>OFFICIAL</span>
      </div>

      {/* ── Desktop sidebar ── */}
      <div className="desktop-sidebar" style={{ position: 'sticky', top: 0, height: '100vh', flexShrink: 0 }}>
        <SidebarContent />
      </div>

      {/* ── Mobile drawer overlay ── */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            display: 'none', position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 1000,
          }}
          className="mobile-overlay"
        />
      )}

      {/* ── Mobile drawer ── */}
      <div className="mobile-drawer" style={{
        display: 'none', position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 1001,
        transform: open ? 'translateX(0)' : 'translateX(-100%)',
        transition: 'transform 0.25s ease',
      }}>
        <SidebarContent />
      </div>

      {/* ── Bottom Navigation Bar (mobile only) ── */}
      <div className="bottom-nav" style={{
        display: 'none',
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 900,
        backgroundColor: '#FFFFFF', borderTop: '1px solid #E5E7EB',
        height: '60px',
      }}>
        {primaryNav.map(item => {
          const isActive = location.pathname === item.path;
          return (
            <button
              key={item.id}
              onClick={() => navigate(item.path)}
              style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', gap: '3px', background: 'none', border: 'none',
                cursor: 'pointer', padding: '6px 4px',
                color: isActive ? '#1A1A1A' : '#9CA3AF',
                minWidth: 0,
              }}
            >
              <item.icon size={20} strokeWidth={isActive ? 2 : 1.5} />
              <span style={{ fontSize: '9px', fontWeight: isActive ? '700' : '400', letterSpacing: '0.03em', textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>
                {item.label.split(' ')[0]}
              </span>
              {isActive && (
                <span style={{ position: 'absolute', bottom: 0, width: '32px', height: '2px', backgroundColor: '#1A1A1A' }} />
              )}
            </button>
          );
        })}

        {/* More button */}
        <button
          onClick={() => setMoreOpen(v => !v)}
          style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', gap: '3px', background: 'none', border: 'none',
            cursor: 'pointer', padding: '6px 4px',
            color: moreOpen || moreNav.some(i => location.pathname === i.path) ? '#1A1A1A' : '#9CA3AF',
            position: 'relative'
          }}
        >
          <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <MoreHorizontal size={20} strokeWidth={1.5} />
            {unreadCount > 0 && (
              <span style={{
                position: 'absolute',
                top: -2,
                right: -2,
                width: '6px',
                height: '6px',
                backgroundColor: '#DC2626',
                borderRadius: '50%'
              }} />
            )}
          </div>
          <span style={{ fontSize: '9px', fontWeight: '400', letterSpacing: '0.03em', textTransform: 'uppercase' }}>More</span>
        </button>
      </div>

      {/* ── More Sheet (slides up from bottom nav) ── */}
      {moreOpen && (
        <>
          <div
            onClick={() => setMoreOpen(false)}
            style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.3)', zIndex: 1100 }}
            className="bottom-nav-overlay"
          />
          <div
            ref={moreSheetRef}
            className="bottom-nav-overlay"
            style={{
              position: 'fixed', bottom: '60px', left: 0, right: 0, zIndex: 1101,
              backgroundColor: '#FFFFFF', borderTop: '1px solid #E5E7EB',
              padding: '8px 0',
            }}
          >
            {moreNav.map(item => {
              const isActive = location.pathname === item.path;
              return (
                <button
                  key={item.id}
                  onClick={() => { navigate(item.path); setMoreOpen(false); }}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: '14px',
                    padding: '14px 24px', background: 'none', border: 'none', cursor: 'pointer',
                    color: isActive ? '#1A1A1A' : '#737373',
                    fontWeight: isActive ? '600' : '400',
                    fontSize: '13px', textAlign: 'left',
                    borderLeft: isActive ? '3px solid #1A1A1A' : '3px solid transparent',
                  }}
                >
                  <item.icon size={18} strokeWidth={isActive ? 2 : 1.5} />
                  <span style={{ flex: 1 }}>{item.label}</span>
                  {item.id === 'notifications-requests' && unreadCount > 0 && (
                    <span style={{
                      backgroundColor: '#DC2626',
                      color: '#FFFFFF',
                      fontSize: '9px',
                      fontWeight: '700',
                      padding: '1px 5px',
                      borderRadius: '10px',
                      lineHeight: 1,
                      marginLeft: 'auto'
                    }}>
                      {unreadCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* Responsive CSS */}
      <style>{`
        @media (min-width: 768px) {
          .mobile-topbar { display: none !important; }
          .desktop-sidebar { display: block !important; }
          .mobile-drawer { display: none !important; }
          .mobile-overlay { display: none !important; }
          .bottom-nav { display: none !important; }
          .bottom-nav-overlay { display: none !important; }
        }
        @media (max-width: 767px) {
          .mobile-topbar { display: flex !important; }
          .desktop-sidebar { display: none !important; }
          .mobile-drawer { display: none !important; }
          .mobile-overlay { display: none !important; }
          .sidebar-close-btn { display: flex !important; }
          .bottom-nav { display: flex !important; }
        }
      `}</style>
    </>
  );
};

export default Sidebar;
