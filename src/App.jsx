import { Suspense, lazy, useState, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/layout/Layout'
import { supabase } from './lib/supabase'
import './App.css'

// Route-level code splitting — each page is a separate JS chunk
const CsvUploader        = lazy(() => import('./components/CsvUploader'))
const Verification       = lazy(() => import('./components/Verification'))
const Reports            = lazy(() => import('./components/Reports'))
const PopulationStatistics  = lazy(() => import('./components/PopulationStatistics'))
const DemographicDashboard  = lazy(() => import('./components/DemographicDashboard'))
const HouseholdForm      = lazy(() => import('./components/HouseholdForm'))
const IDCardScanner      = lazy(() => import('./components/IDCardScanner'))
const Login              = lazy(() => import('./components/Login'))
const UserManagement     = lazy(() => import('./components/UserManagement'))

const PageFallback = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
      <div style={{
        width: '32px', height: '32px', border: '2px solid #E5E7EB',
        borderTop: '2px solid #1A1A1A', borderRadius: '50%',
        animation: 'spin 0.7s linear infinite',
      }} />
      <span style={{ fontSize: '11px', color: '#737373', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Loading</span>
    </div>
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </div>
)

const UploadPage = ({ user }) => (
  <div className="flex flex-col gap-8 p-6 sm:p-8 xl:p-10 max-w-7xl xl:max-w-[1440px] mx-auto">
    <div>
      <h2 style={{ fontSize: '20px', margin: '0 0 8px 0', color: '#1A1A1A', fontWeight: '500', letterSpacing: '0.02em' }}>DATA UPLOAD</h2>
      <p style={{ margin: 0, color: '#737373', fontSize: '12px' }}>Bulk import household records from Excel, CSV, or JSON files.</p>
    </div>
    <CsvUploader user={user} />
  </div>
)

const Placeholder = ({ title }) => (
  <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
    <h2 style={{ color: 'var(--primary-color)' }}>{title} Module</h2>
    <p>This section is currently under development.</p>
  </div>
)

function App() {
  const [user, setUser] = useState(null);

  const handleLogin = (data) => {
    setUser(data);
  };

  // Heartbeat: refresh last_seen_at every 2 minutes while logged in
  useEffect(() => {
    if (!user?.id) return;
    const ping = () =>
      supabase.from('profiles').update({ last_seen_at: new Date().toISOString() }).eq('id', user.id);
    const timer = setInterval(ping, 2 * 60 * 1000);
    return () => clearInterval(timer);
  }, [user?.id]);

  const handleLogout = () => {
    setUser(null);
  };

  // Gate: Username + PIN + Email OTP login
  if (!user) {
    return (
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route path="/login" element={<Login onLogin={handleLogin} />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Suspense>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<Layout user={user} onLogout={handleLogout} />}>
        <Route index element={<Navigate to="/verification" replace />} />
        <Route path="verification" element={<Suspense fallback={<PageFallback />}><Verification user={user} /></Suspense>} />
        <Route path="upload" element={<Suspense fallback={<PageFallback />}><UploadPage user={user} /></Suspense>} />
        <Route path="scanner" element={<Suspense fallback={<PageFallback />}><IDCardScanner /></Suspense>} />
        <Route path="central-database" element={
          user?.access_level === 'viewer'
            ? <Navigate to="/verification" replace />
            : <Suspense fallback={<PageFallback />}><Reports user={user} /></Suspense>
        } />
        <Route path="statistics" element={<Suspense fallback={<PageFallback />}><PopulationStatistics user={user} /></Suspense>} />
        <Route path="demographics" element={<Suspense fallback={<PageFallback />}><DemographicDashboard user={user} /></Suspense>} />
        <Route path="registration" element={<Suspense fallback={<PageFallback />}><HouseholdForm user={user} /></Suspense>} />
        <Route path="users" element={<Suspense fallback={<PageFallback />}><UserManagement user={user} /></Suspense>} />
        <Route path="settings" element={<Placeholder title="Settings" />} />
        <Route path="*" element={<Navigate to="/verification" replace />} />
      </Route>
      <Route path="/login" element={<Navigate to="/verification" replace />} />
    </Routes>
  );
}

export default App
