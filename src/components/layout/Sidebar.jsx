import React from 'react';
import { NavLink } from 'react-router-dom';
import { Users, LineChart, FileText, Settings, Landmark } from 'lucide-react';

const Sidebar = () => {
  const menuItems = [
    { id: 'verification', path: '/verification', label: 'Verification', icon: Users },
    { id: 'statistics', path: '/statistics', label: 'Population Statistics', icon: LineChart },
    { id: 'reports', path: '/reports', label: 'Reports', icon: FileText },
    { id: 'settings', path: '/settings', label: 'Settings', icon: Settings }
  ];

  return (
    <div style={{
      width: '260px',
      backgroundColor: '#F8FAFC',
      borderRight: '1px solid #E2E8F0',
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      position: 'sticky',
      top: 0
    }}>
      {/* Logo/Brand */}
      <div style={{
        padding: '1.5rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        borderBottom: '1px solid transparent'
      }}>
        <div style={{
          backgroundColor: 'var(--primary-color)',
          color: 'white',
          padding: '0.5rem',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <Landmark size={24} />
        </div>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.125rem', color: 'var(--text-primary)' }}>Population</h2>
          <h2 style={{ margin: 0, fontSize: '1.125rem', color: 'var(--text-primary)' }}>Management</h2>
          <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>REGISTRY V2.4</span>
        </div>
      </div>

      {/* Navigation Links */}
      <nav style={{ padding: '1rem', flex: 1 }}>
        {menuItems.map(item => (
          <NavLink
            key={item.id}
            to={item.path}
            style={({ isActive }) => ({
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              padding: '0.875rem 1rem',
              marginBottom: '0.5rem',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: isActive ? 'var(--primary-color)' : 'transparent',
              color: isActive ? 'white' : 'var(--text-secondary)',
              fontWeight: isActive ? '600' : '500',
              textDecoration: 'none',
              transition: 'all 0.2s ease'
            })}
          >
            {({ isActive }) => (
              <>
                <item.icon size={20} style={{ color: isActive ? 'white' : 'var(--text-secondary)' }} />
                {item.label}
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
};

export default Sidebar;
