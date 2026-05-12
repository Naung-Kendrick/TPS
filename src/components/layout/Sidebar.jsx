import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Users, UserPlus, LineChart, FileText, Settings, Upload, ScanLine, Menu, X } from 'lucide-react';
import logo from '../../assets/fonts/IDTL_logo.png';

const Sidebar = () => {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  // Close drawer on route change (mobile)
  useEffect(() => { setOpen(false); }, [location.pathname]);

  // Close drawer on wide screen resize
  useEffect(() => {
    const handler = () => { if (window.innerWidth >= 768) setOpen(false); };
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

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

      {/* Responsive CSS */}
      <style>{`
        @media (min-width: 768px) {
          .mobile-topbar { display: none !important; }
          .desktop-sidebar { display: block !important; }
          .mobile-drawer { display: none !important; }
          .mobile-overlay { display: none !important; }
        }
        @media (max-width: 767px) {
          .mobile-topbar { display: flex !important; }
          .desktop-sidebar { display: none !important; }
          .mobile-drawer { display: block !important; }
          .mobile-overlay { display: block !important; }
          .sidebar-close-btn { display: flex !important; }
        }
      `}</style>
    </>
  );
};

export default Sidebar;
