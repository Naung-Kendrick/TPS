import React, { useState, useEffect, useRef } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Users, UserPlus, LineChart, FileText, Settings, Upload, ScanLine, Menu, X, MoreHorizontal } from 'lucide-react';
import logo from '../../assets/fonts/IDTL_logo.png';

const Sidebar = () => {
  const [open, setOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const moreSheetRef = useRef(null);
  const touchStartX = useRef(null);
  const touchStartY = useRef(null);

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
    { id: 'verification',     path: '/verification',     label: 'Data Verification',      icon: Users          },
    { id: 'upload',           path: '/upload',           label: 'Data Upload',            icon: Upload         },
    { id: 'scanner',          path: '/scanner',          label: 'ID Card Scanner',        icon: ScanLine       },
    { id: 'statistics',       path: '/statistics',       label: 'Population Statistics',  icon: LineChart      },
    { id: 'registration',     path: '/registration',     label: 'Household Registration', icon: UserPlus       },
    { id: 'central-database', path: '/central-database', label: 'Central Database',       icon: FileText       },
    { id: 'settings',         path: '/settings',         label: 'Settings',               icon: Settings       },
  ];

  // Bottom nav: first 4 primary + "More" for the rest
  const primaryNav = menuItems.slice(0, 4);
  const moreNav = menuItems.slice(4);

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
        {menuItems.map(item => (
          <NavLink
            key={item.id}
            to={item.path}
            style={({ isActive }) => ({
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '9px 12px', marginBottom: '4px',
              border: isActive ? '1px solid #1A1A1A' : '1px solid transparent',
              backgroundColor: isActive ? '#FFFFFF' : 'transparent',
              color: '#1A1A1A', fontWeight: isActive ? '600' : '400',
              textDecoration: 'none', fontSize: '12px', letterSpacing: '0.02em', transition: 'all 0.1s',
            })}
          >
            {({ isActive }) => (
              <>
                <item.icon size={14} strokeWidth={isActive ? 2 : 1.5} style={{ color: '#1A1A1A', flexShrink: 0 }} />
                <span>{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
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
        alignItems: 'center', justifyContent: 'flex-start', gap: '10px',
        padding: '0 14px', height: '48px',
      }}>
        {/* Seal */}
        <div style={{
          width: '30px', height: '30px', flexShrink: 0,
          border: '2px solid #1A1A1A', backgroundColor: '#FFFFFF',
          display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
        }}>
          <img src={logo} alt="IDTL Seal" style={{ width: '88%', height: '88%', objectFit: 'contain' }} />
        </div>

        {/* Title block */}
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', minWidth: 0 }}>
          <span style={{ fontSize: '7.5px', fontWeight: '600', color: '#737373', letterSpacing: '0.1em', textTransform: 'uppercase', lineHeight: 1, whiteSpace: 'nowrap' }}>IDTL · Ta'ang Land Immigration</span>
          <span style={{ fontSize: '13px', fontWeight: '800', color: '#1A1A1A', letterSpacing: '0.07em', textTransform: 'uppercase', lineHeight: 1.2 }}>TPS</span>
          <span style={{ fontSize: '8px', fontWeight: '500', color: '#737373', letterSpacing: '0.01em', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>တီုင်စေတ်မေန်းတိုအီး အဆိုးယကပီုန်တအာင်း</span>
        </div>

        {/* Official badge — pushed to right */}
        <span style={{
          marginLeft: 'auto', flexShrink: 0,
          fontSize: '7px', fontWeight: '700', color: '#FFFFFF',
          backgroundColor: '#1A1A1A',
          padding: '3px 7px', letterSpacing: '0.08em', textTransform: 'uppercase',
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
          }}
        >
          <MoreHorizontal size={20} strokeWidth={1.5} />
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
                  {item.label}
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
