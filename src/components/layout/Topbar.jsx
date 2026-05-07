import React from 'react';
import { Search, Bell, HelpCircle, User } from 'lucide-react';

const Topbar = () => {
  return (
    <header style={{
      height: '72px',
      backgroundColor: 'white',
      borderBottom: '1px solid #E2E8F0',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 2rem',
      position: 'sticky',
      top: 0,
      zIndex: 10
    }}>
      {/* Title */}
      <h1 style={{ 
        margin: 0, 
        fontSize: '1.5rem', 
        color: 'var(--primary-color)',
        fontFamily: "'Public Sans', sans-serif"
      }}>
        PopRegistry Admin
      </h1>

      {/* Search Bar */}
      <div style={{ flex: 1, maxWidth: '400px', margin: '0 2rem', position: 'relative' }}>
        <div style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }}>
          <Search size={18} />
        </div>
        <input 
          type="text" 
          placeholder="ရှာဖွေရန်..." 
          style={{
            width: '100%',
            padding: '0.6rem 1rem 0.6rem 2.5rem',
            borderRadius: '24px',
            border: 'none',
            backgroundColor: '#F1F5F9',
            fontSize: '0.875rem'
          }}
        />
      </div>

      {/* Right Icons & Profile */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
        <button style={{ background: 'none', border: 'none', padding: 0, color: 'var(--text-secondary)' }}>
          <Bell size={20} />
        </button>
        <button style={{ background: 'none', border: 'none', padding: 0, color: 'var(--text-secondary)' }}>
          <HelpCircle size={20} />
        </button>
        
        <div style={{ width: '1px', height: '24px', backgroundColor: '#E2E8F0', margin: '0 0.5rem' }}></div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontWeight: '600', fontSize: '0.875rem', color: 'var(--text-primary)' }}>U Myo Min</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>System Administrator</div>
          </div>
          <div style={{ 
            width: '36px', 
            height: '36px', 
            borderRadius: '50%', 
            backgroundColor: 'var(--secondary-color)', 
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden'
          }}>
            <User size={20} />
          </div>
        </div>
      </div>
    </header>
  );
};

export default Topbar;
