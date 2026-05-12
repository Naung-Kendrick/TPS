import React, { useState, useEffect, useRef } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Users, UserPlus, LineChart, FileText, Settings, Upload, ScanLine, Menu, X, MoreHorizontal } from 'lucide-react';
import logo from '../../assets/fonts/IDTL_logo.png';

const Sidebar = () => {
  const [open, setOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const location = useLocation();
  const touchStartX = useRef(null);
  const touchStartY = useRef(null);

  // Close drawer on route change (mobile)
  useEffect(() => { setOpen(false); setMoreOpen(false); }, [location.pathname]);

  // Close drawer on wide screen resize
  useEffect(() => {
    const handler = () => { if (window.innerWidth >= 768) setOpen(false); };
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  // Swipe to open (from left edge) / close drawer
  useEffect(() => {
    const handleTouchStart = (e) => {
      touchStartX.current = e.touches[0].clientX;
      touchStartY.current = e.touches[0].clientY;
    };
    const handleTouchEnd = (e) => {
      if (touchStartX.current === null) return;
      const dx = e.changedTouches[0].clientX - touchStartX.current;
      const dy = Math.abs(e.changedTouches[0].clientY - touchStartY.current);
      // Only register horizontal swipes
      if (dy > 60) { touchStartX.current = null; return; }
      if (!open && touchStartX.current < 32 && dx > 60) setOpen(true);
      if (open && dx < -60) setOpen(false);
      touchStartX.current = null;
    };
    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });
    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [open]);

  const menuItems = [
    { id: 'verification',     path: '/verification',     label: 'Data Verification',      icon: Users          },
    { id: 'upload',           path: '/upload',           label: 'Data Upload',          icon: Upload         },
    { id: 'scanner',          path: '/scanner',          label: 'ID Card Scanner',       icon: ScanLine       },
    { id: 'statistics',       path: '/statistics',       label: 'Population Statistics', icon: LineChart     },
    { id: 'registration',     path: '/registration',     label: 'Household Registration', icon: UserPlus      },
    { id: 'central-database', path: '/central-database', label: 'Central Database',      icon: FileText       },
    { id: 'settings',         path: '/settings',         label: 'Settings',              icon: Settings       },
  ];

  const SidebarContent = () => (
    <div style={{
      width: '240px', flexShrink: 0, backgroundColor: '#FFFFFF',
      borderRight: '1px solid #E5E7EB', display: 'flex', flexDirection: 'column',
      height: '100%', overflowY: 'auto',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '12px',
        padding: '16px 20px', borderBottom: '1px solid #E5E7EB',
      }}>
        <div style={{
          width: '40px', height: '40px', border: '1px solid #E5E7EB',
          backgroundColor: '#FFFFFF', display: 'flex', alignItems: 'center',
          justifyContent: 'center', overflow: 'hidden', flexShrink: 0
        }}>
          <img src={logo} alt="TPS" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '15px', fontWeight: '700', color: '#1A1A1A', letterSpacing: '0.05em', textTransform: 'uppercase' }}>TPS</div>
          <div style={{ fontSize: '10px', color: '#737373', marginTop: '1px' }}>Ta'ang Population System</div>
        </div>
        {/* Close button — mobile only */}
        <button onClick={() => setOpen(false)} style={{
          display: 'none', background: 'none', border: 'none', cursor: 'pointer', padding: '4px',
          color: '#737373', flexShrink: 0,
        }} className="sidebar-close-btn">
          <X size={18} />
        </button>
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
      {/* ── Mobile top bar ── */}
      <div className="mobile-topbar" style={{
        display: 'none', position: 'fixed', top: 0, left: 0, right: 0, zIndex: 900,
        backgroundColor: '#FFFFFF', borderBottom: '1px solid #E5E7EB',
        alignItems: 'center', gap: '12px', padding: '10px 16px', height: '52px',
      }}>
        <button onClick={() => setOpen(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: '#1A1A1A' }}>
          <Menu size={20} />
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <img src={logo} alt="TPS" style={{ width: '28px', height: '28px', objectFit: 'contain', border: '1px solid #E5E7EB' }} />
          <span style={{ fontSize: '13px', fontWeight: '700', letterSpacing: '0.05em', textTransform: 'uppercase' }}>TPS</span>
        </div>
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

      {/* ── Bottom Navigation (mobile only) ── */}
      {/* Primary 5 items always visible; remaining 2 in "More" popover */}
      <nav className="bottom-nav" style={{
        display: 'none', position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 900,
        backgroundColor: '#FFFFFF', borderTop: '1px solid #E5E7EB',
        height: '60px', alignItems: 'stretch',
      }}>
        {menuItems.slice(0, 5).map(item => {
          const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + '/');
          return (
            <NavLink
              key={item.id}
              to={item.path}
              style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', gap: '3px', textDecoration: 'none',
                color: isActive ? '#1A1A1A' : '#9CA3AF',
                borderTop: isActive ? '2px solid #1A1A1A' : '2px solid transparent',
                minWidth: 0, padding: '6px 2px 4px',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              <item.icon size={20} strokeWidth={isActive ? 2 : 1.5} />
              <span style={{ fontSize: '9px', fontWeight: isActive ? '600' : '400', letterSpacing: '0.02em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%', textAlign: 'center' }}>
                {item.label.split(' ')[0]}
              </span>
            </NavLink>
          );
        })}

        {/* More button */}
        <button
          onClick={() => setMoreOpen(v => !v)}
          style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', gap: '3px', background: 'none', border: 'none',
            cursor: 'pointer', color: menuItems.slice(5).some(i => location.pathname === i.path) ? '#1A1A1A' : '#9CA3AF',
            borderTop: menuItems.slice(5).some(i => location.pathname === i.path) ? '2px solid #1A1A1A' : '2px solid transparent',
            minWidth: 0, padding: '6px 2px 4px',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          <MoreHorizontal size={20} strokeWidth={1.5} />
          <span style={{ fontSize: '9px', fontWeight: '400', letterSpacing: '0.02em' }}>More</span>
        </button>

        {/* More popover */}
        {moreOpen && (
          <>
            <div onClick={() => setMoreOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 898 }} />
            <div style={{
              position: 'fixed', bottom: '64px', right: '8px', zIndex: 899,
              backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB',
              minWidth: '180px', boxShadow: '0 -4px 16px rgba(0,0,0,0.08)',
            }}>
              {menuItems.slice(5).map(item => {
                const isActive = location.pathname === item.path;
                return (
                  <NavLink
                    key={item.id}
                    to={item.path}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '10px',
                      padding: '12px 16px', textDecoration: 'none',
                      color: '#1A1A1A', fontSize: '12px', fontWeight: isActive ? '600' : '400',
                      borderLeft: isActive ? '3px solid #1A1A1A' : '3px solid transparent',
                      WebkitTapHighlightColor: 'transparent',
                    }}
                  >
                    <item.icon size={16} strokeWidth={isActive ? 2 : 1.5} />
                    {item.label}
                  </NavLink>
                );
              })}
            </div>
          </>
        )}
      </nav>

      {/* Responsive CSS */}
      <style>{`
        @media (min-width: 768px) {
          .mobile-topbar   { display: none !important; }
          .desktop-sidebar { display: block !important; }
          .mobile-drawer   { display: none !important; }
          .mobile-overlay  { display: none !important; }
          .bottom-nav      { display: none !important; }
        }
        @media (max-width: 767px) {
          .mobile-topbar   { display: flex !important; }
          .desktop-sidebar { display: none !important; }
          .mobile-drawer   { display: block !important; }
          .mobile-overlay  { display: block !important; }
          .sidebar-close-btn { display: flex !important; }
          .bottom-nav      { display: flex !important; }
        }
      `}</style>
    </>
  );
};

export default Sidebar;
