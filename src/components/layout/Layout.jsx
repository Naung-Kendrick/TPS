import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import logo from '/icons/icon-192.png';

const Layout = () => {
  return (
    <div style={{ display: 'flex', width: '100%', minHeight: '100vh', backgroundColor: '#FFFFFF' }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden', position: 'relative' }}>
        {/* Watermark — corner stamp seal */}
        <div style={{
          position: 'fixed',
          bottom: '40px',
          right: '40px',
          width: '260px',
          height: '260px',
          backgroundImage: `url(${logo})`,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'center',
          backgroundSize: 'contain',
          opacity: 0.08,
          pointerEvents: 'none',
          zIndex: 0,
          filter: 'grayscale(100%)',
          transform: 'rotate(-8deg)',
        }} />
        <main style={{ flex: 1, overflowY: 'auto', backgroundColor: 'transparent', position: 'relative', zIndex: 1 }} className="main-content">
          <Outlet />
        </main>
      </div>
      <style>{`
        @media (max-width: 767px) {
          .main-content {
            padding-top: 48px;
            padding-bottom: 60px;
          }
        }
      `}</style>
    </div>
  );
};

export default Layout;
