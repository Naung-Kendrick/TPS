import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';

const Layout = () => {
  return (
    <div style={{ display: 'flex', width: '100%', minHeight: '100vh', backgroundColor: '#FFFFFF' }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
        <main style={{ flex: 1, overflowY: 'auto', backgroundColor: '#FFFFFF' }} className="main-content">
          <Outlet />
        </main>
      </div>
      <style>{`
        @media (max-width: 767px) {
          .main-content {
            padding-top: 52px;
          }
        }
      `}</style>
    </div>
  );
};

export default Layout;
