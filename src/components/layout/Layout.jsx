import React, { useEffect, useRef } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import logo from '/icons/icon-192.png';

// Mobile page order — matches bottom nav
const PAGE_ORDER = [
  '/verification',
  '/upload',
  '/scanner',
  '/statistics',
  '/registration',
  '/central-database',
  '/settings',
];

const Layout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const txRef = useRef(null);
  const tyRef = useRef(null);

  useEffect(() => {
    const onStart = (e) => {
      txRef.current = e.touches[0].clientX;
      tyRef.current = e.touches[0].clientY;
    };
    const onEnd = (e) => {
      if (txRef.current === null) return;
      const dx = e.changedTouches[0].clientX - txRef.current;
      const dy = Math.abs(e.changedTouches[0].clientY - tyRef.current);
      const startX = txRef.current;
      txRef.current = null;

      // Skip if mostly vertical (scrolling)
      if (dy > Math.abs(dx) * 0.65) return;
      // Skip if swipe too short
      if (Math.abs(dx) < 55) return;
      // Skip if starting from left edge — that's the drawer gesture
      if (startX < 30) return;
      // Skip on desktop
      if (window.innerWidth >= 768) return;

      const cur = PAGE_ORDER.indexOf(location.pathname);
      if (cur === -1) return;

      if (dx < 0 && cur < PAGE_ORDER.length - 1) {
        // Swipe left → next page
        navigate(PAGE_ORDER[cur + 1]);
      } else if (dx > 0 && cur > 0) {
        // Swipe right → previous page
        navigate(PAGE_ORDER[cur - 1]);
      }
    };

    document.addEventListener('touchstart', onStart, { passive: true });
    document.addEventListener('touchend', onEnd, { passive: true });
    return () => {
      document.removeEventListener('touchstart', onStart);
      document.removeEventListener('touchend', onEnd);
    };
  }, [location.pathname, navigate]);

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
          <div key={location.pathname} className="tps-page-enter" style={{ minHeight: '100%' }}>
            <Outlet />
          </div>
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
