import React from 'react';
import { NavLink } from 'react-router-dom';
import { Users, UserPlus, LineChart, FileText, Settings } from 'lucide-react';
import logo from '../../assets/logo.jpg';

const Sidebar = () => {
  const menuItems = [
    { id: 'verification',  path: '/verification',  label: 'Data Verification',       icon: Users      },
    { id: 'statistics',    path: '/statistics',    label: 'Population Statistics',    icon: LineChart  },
    { id: 'registration',  path: '/registration',  label: 'Household Registration',   icon: UserPlus   },
    { id: 'reports',       path: '/reports',       label: 'Reports',                  icon: FileText   },
    { id: 'settings',      path: '/settings',      label: 'Settings',                 icon: Settings   },
  ];

  return (
    <div style={{
      width: '240px',
      flexShrink: 0,
      backgroundColor: '#FFFFFF',
      borderRight: '1px solid #E5E7EB',
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      position: 'sticky',
      top: 0,
      overflowY: 'auto',
    }}>

      {/* ── Workspace header ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '16px 20px',
        borderBottom: '1px solid #E5E7EB',
        cursor: 'pointer',
      }}
        onMouseOver={e => e.currentTarget.style.backgroundColor = '#FAFAFA'}
        onMouseOut={e => e.currentTarget.style.backgroundColor = '#FFFFFF'}
      >
        <div style={{
          width: '48px', height: '48px',
          border: '1px solid #E5E7EB',
          backgroundColor: '#FFFFFF',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          flexShrink: 0
        }}>
          <img src={logo} alt="TLFUG" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        </div>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{
            fontSize: '16px', fontWeight: '700', color: '#1A1A1A',
            lineHeight: '1.2', whiteSpace: 'nowrap',
            overflow: 'hidden', textOverflow: 'ellipsis',
            letterSpacing: '0.05em',
            textTransform: 'uppercase'
          }}>TPS</div>
          <div style={{ fontSize: '10px', color: '#737373', lineHeight: '1.2', letterSpacing: '0.02em', marginTop: '2px' }}>Ta'ang Population System</div>
        </div>
      </div>

      {/* ── Nav section ── */}
      <div style={{ padding: '16px 8px', flex: 1 }}>

        <div style={{
          fontSize: '10px', fontWeight: '600', color: '#737373',
          padding: '0 12px 8px',
          textTransform: 'uppercase', letterSpacing: '0.1em',
        }}>
          Navigation
        </div>

        {menuItems.map(item => (
          <NavLink
            key={item.id}
            to={item.path}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '8px 12px',
              marginBottom: '4px',
              border: isActive ? '1px solid #1A1A1A' : '1px solid transparent',
              backgroundColor: isActive ? '#FFFFFF' : 'transparent',
              color: '#1A1A1A',
              fontWeight: isActive ? '600' : '400',
              textDecoration: 'none',
              fontSize: '12px',
              letterSpacing: '0.02em',
              transition: 'all 0.1s',
            })}
            onMouseOver={e => {
              if (!e.currentTarget.style.borderColor || e.currentTarget.style.borderColor === 'transparent') {
                e.currentTarget.style.backgroundColor = '#F3F4F6';
              }
            }}
            onMouseOut={e => {
              if (!e.currentTarget.style.borderColor || e.currentTarget.style.borderColor === 'transparent') {
                e.currentTarget.style.backgroundColor = 'transparent';
              }
            }}
          >
            {({ isActive }) => (
              <>
                <item.icon
                  size={14}
                  strokeWidth={isActive ? 2 : 1.5}
                  style={{ color: '#1A1A1A', flexShrink: 0 }}
                />
                {item.label}
              </>
            )}
          </NavLink>
        ))}
      </div>

      {/* ── Footer ── */}
      <div style={{
        padding: '12px 20px',
        borderTop: '1px solid #E5E7EB',
        fontSize: '10px',
        color: '#737373',
        textAlign: 'center',
        letterSpacing: '0.05em',
        textTransform: 'uppercase'
      }}>
        v2.4
      </div>
    </div>
  );
};

export default Sidebar;
