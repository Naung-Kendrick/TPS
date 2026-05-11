import React from 'react';
import { Search, Bell, ChevronDown } from 'lucide-react';
import flag from "../../assets/taang_flag.jpg";

const Topbar = () => {
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
      zIndex: 10,
      flexShrink: 0,
    }}>

      {/* ── Left: breadcrumb style title ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <img
          src={flag}
          alt="Ta'ang Flag"
          style={{ height: '16px', border: '1px solid #E5E7EB', objectFit: 'cover' }}
        />
        <span style={{ fontSize: '12px', fontWeight: '600', color: '#1A1A1A', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
          TLFUG Immigration
        </span>
        <span style={{ fontSize: '12px', color: '#737373' }}>|</span>
        <span style={{ fontSize: '12px', color: '#737373' }}>
          တအာင်းပြည်လွတ်မြောက်ရေးတပ်မတော်
        </span>
      </div>

      {/* ── Right: search + bell + profile ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>

        {/* Search pill */}
        <div style={{ position: 'relative' }}>
          <div style={{
            position: 'absolute', left: '10px', top: '50%',
            transform: 'translateY(-50%)', color: '#737373',
            pointerEvents: 'none',
          }}>
            <Search size={12} />
          </div>
          <input
            type="text"
            placeholder="SEARCH..."
            style={{
              width: '200px',
              padding: '6px 10px 6px 28px',
              borderRadius: '0px',
              border: '1px solid #E5E7EB',
              backgroundColor: '#FAFAFA',
              fontSize: '11px',
              color: '#1A1A1A',
              outline: 'none',
              letterSpacing: '0.05em'
            }}
          />
        </div>

        {/* Bell */}
        <button style={{
          background: 'none', border: 'none',
          padding: '6px',
          color: '#737373', cursor: 'pointer',
          display: 'flex', alignItems: 'center',
          transition: 'background 0.1s',
        }}
          onMouseOver={e => e.currentTarget.style.backgroundColor = '#F3F4F6'}
          onMouseOut={e => e.currentTarget.style.backgroundColor = 'transparent'}
        >
          <Bell size={14} />
        </button>

        {/* Divider */}
        <div style={{ width: '1px', height: '20px', backgroundColor: '#E5E7EB', margin: '0 4px' }} />

        {/* Profile */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          cursor: 'pointer', padding: '6px 8px',
          transition: 'background 0.1s',
        }}
          onMouseOver={e => e.currentTarget.style.backgroundColor = '#F3F4F6'}
          onMouseOut={e => e.currentTarget.style.backgroundColor = 'transparent'}
        >
          <div style={{
            width: '24px', height: '24px',
            backgroundColor: '#1A1A1A', color: '#FFFFFF',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '10px', fontWeight: '600', flexShrink: 0,
          }}>
            UM
          </div>
          <span style={{ fontSize: '12px', fontWeight: '500', color: '#1A1A1A' }}>U MYO MIN</span>
          <ChevronDown size={12} color="#737373" />
        </div>

      </div>
    </header>
  );
};

export default Topbar;
