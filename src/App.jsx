import { Suspense, lazy, useState, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/layout/Layout'
import { supabase } from './lib/supabase'
import IntroAnimation from './components/IntroAnimation'
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
const NotificationsRequests = lazy(() => import('./components/NotificationsRequests'))
const DatabaseBackup        = lazy(() => import('./components/DatabaseBackup'))

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
      <p style={{ margin: 0, color: '#737373', fontSize: '11px', fontWeight: '500', fontFamily: "'Inter', sans-serif", textTransform: 'uppercase', letterSpacing: '0.05em' }}>Bulk import household records from Excel, CSV, or JSON files.</p>
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
  const [sessionLoading, setSessionLoading] = useState(true);
  const [introShown, setIntroShown] = useState(false);

  const handleIntroDone = () => {
    setIntroShown(true);
  };

  const handleLogout = async () => {
    // Security: clear all PII data from localStorage on logout
    try {
      localStorage.removeItem('tps_retry_queue');
      localStorage.removeItem('tps_household_form_draft');
      localStorage.removeItem('tps_backup_history_logs');
      sessionStorage.clear();
      await supabase.auth.signOut();
    } catch (_) {}
    setUser(null);
  };

  const handleLogin = (data) => {
    setUser(data);
  };

  // 1. Session Restoration on Mount / Page Refresh
  useEffect(() => {
    let mounted = true;
    const restoreSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('id, role, is_active, last_seen_at, access_level, allowed_districts, allowed_townships')
            .eq('id', session.user.id)
            .single();

          if (profile && profile.is_active !== false && mounted) {
            setUser({
              ...session.user,
              profile,
              role: profile.role,
              access_level: profile.access_level || 'central',
              allowed_districts: profile.allowed_districts || [],
              allowed_townships: profile.allowed_townships || [],
            });
          } else if (profile?.is_active === false) {
            await supabase.auth.signOut();
          }
        }
      } catch (err) {
        console.error('Session restoration error:', err);
      } finally {
        if (mounted) setSessionLoading(false);
      }
    };

    restoreSession();
    return () => { mounted = false; };
  }, []);

  // 2. 30-Minute Idle Timeout (Auto-Logout on inactivity)
  useEffect(() => {
    if (!user) return;

    const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
    let idleTimer;

    const resetIdleTimer = () => {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        console.log('User inactive for 30 minutes. Auto logging out...');
        handleLogout();
      }, IDLE_TIMEOUT_MS);
    };

    const activityEvents = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    activityEvents.forEach(evt => window.addEventListener(evt, resetIdleTimer));
    resetIdleTimer(); // start timer

    return () => {
      clearTimeout(idleTimer);
      activityEvents.forEach(evt => window.removeEventListener(evt, resetIdleTimer));
    };
  }, [user]);

  // Heartbeat: refresh last_seen_at every 2 minutes while logged in
  useEffect(() => {
    if (!user?.id) return;
    const ping = () =>
      supabase.from('profiles').update({ last_seen_at: new Date().toISOString() }).eq('id', user.id);
    const timer = setInterval(ping, 2 * 60 * 1000);
    return () => clearInterval(timer);
  }, [user?.id]);

  // Realtime: refresh user profile when an admin changes role/access_level
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`profile-self-${user.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'profiles',
        filter: `id=eq.${user.id}`,
      }, (payload) => {
        const updated = payload.new;
        if (updated.is_active === false) {
          handleLogout();
          return;
        }
        setUser(prev => ({
          ...prev,
          role:               updated.role               ?? prev.role,
          access_level:       updated.access_level       ?? prev.access_level,
          allowed_districts:  updated.allowed_districts  ?? prev.allowed_districts,
          allowed_townships:  updated.allowed_townships  ?? prev.allowed_townships,
          is_active:          updated.is_active          ?? prev.is_active,
        }));
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [user?.id]);

  if (sessionLoading) {
    return <PageFallback />;
  }

  // Gate: Username + PIN + Email OTP login
  if (!user) {
    return (
      <>
        {!introShown && <IntroAnimation onDone={handleIntroDone} />}
        <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route path="/login" element={<Login onLogin={handleLogin} />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </Suspense>
      </>
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
          (user?.access_level === 'viewer' || user?.access_level === 'sub_township')
            ? <Navigate to="/verification" replace />
            : <Suspense fallback={<PageFallback />}><Reports user={user} /></Suspense>
        } />
        <Route path="statistics" element={<Suspense fallback={<PageFallback />}><PopulationStatistics user={user} /></Suspense>} />
        <Route path="demographics" element={<Suspense fallback={<PageFallback />}><DemographicDashboard user={user} /></Suspense>} />
        <Route path="registration" element={<Suspense fallback={<PageFallback />}><HouseholdForm user={user} /></Suspense>} />
        <Route path="users" element={
          (user?.role === 'system' || user?.role === 'master')
            ? <Suspense fallback={<PageFallback />}><UserManagement user={user} /></Suspense>
            : <Navigate to="/verification" replace />
        } />
        <Route path="notifications-requests" element={<Suspense fallback={<PageFallback />}><NotificationsRequests user={user} /></Suspense>} />
        <Route path="backup" element={
          ((user?.role === 'system' || user?.role === 'master') && (user?.access_level || user?.profile?.access_level) === 'central')
            ? <Suspense fallback={<PageFallback />}><DatabaseBackup user={user} /></Suspense>
            : <Navigate to="/verification" replace />
        } />
        <Route path="*" element={<Navigate to="/verification" replace />} />
      </Route>
      <Route path="/login" element={<Navigate to="/verification" replace />} />
    </Routes>
  );
}

export default App
