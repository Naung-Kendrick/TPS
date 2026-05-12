import { Suspense, lazy } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/layout/Layout'
import './App.css'

// Route-level code splitting — each page is a separate JS chunk
const CsvUploader        = lazy(() => import('./components/CsvUploader'))
const ExcelChecker       = lazy(() => import('./components/ExcelChecker'))
const Verification       = lazy(() => import('./components/Verification'))
const Reports            = lazy(() => import('./components/Reports'))
const PopulationStatistics = lazy(() => import('./components/PopulationStatistics'))
const HouseholdForm      = lazy(() => import('./components/HouseholdForm'))
const IDCardScanner      = lazy(() => import('./components/IDCardScanner'))

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

const UploadPage = () => (
  <div className="p-8 max-w-5xl mx-auto space-y-8">
    <div>
      <h2 style={{ fontSize: '20px', margin: '0 0 8px 0', color: '#1A1A1A', fontWeight: '500', letterSpacing: '0.02em' }}>DATA UPLOAD</h2>
      <p style={{ margin: '0 0 32px 0', color: '#737373', fontSize: '12px' }}>Bulk import household records from CSV, JSON, or Excel files.</p>
    </div>
    <CsvUploader />
    <ExcelChecker />
  </div>
)

const Placeholder = ({ title }) => (
  <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
    <h2 style={{ color: 'var(--primary-color)' }}>{title} Module</h2>
    <p>This section is currently under development.</p>
  </div>
)

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Navigate to="/verification" replace />} />
        <Route path="verification" element={<Suspense fallback={<PageFallback />}><Verification /></Suspense>} />
        <Route path="upload" element={<Suspense fallback={<PageFallback />}><UploadPage /></Suspense>} />
        <Route path="scanner" element={<Suspense fallback={<PageFallback />}><IDCardScanner /></Suspense>} />
        <Route path="central-database" element={<Suspense fallback={<PageFallback />}><Reports /></Suspense>} />
        <Route path="statistics" element={<Suspense fallback={<PageFallback />}><PopulationStatistics /></Suspense>} />
        <Route path="registration" element={<Suspense fallback={<PageFallback />}><HouseholdForm /></Suspense>} />
        <Route path="settings" element={<Placeholder title="Settings" />} />
      </Route>
    </Routes>
  )
}

export default App
