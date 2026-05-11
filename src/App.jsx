import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/layout/Layout'
import CsvUploader from './components/CsvUploader'
import Verification from './components/Verification'
import Reports from './components/Reports'
import PopulationStatistics from './components/PopulationStatistics'
import HouseholdForm from './components/HouseholdForm'
import './App.css'

const UploadPage = () => (
  <div className="p-8 max-w-4xl mx-auto">
    <h2 style={{ fontSize: '20px', margin: '0 0 8px 0', color: '#1A1A1A', fontWeight: '500', letterSpacing: '0.02em' }}>DATA UPLOAD</h2>
    <p style={{ margin: '0 0 32px 0', color: '#737373', fontSize: '12px' }}>Bulk import household records from a CSV or JSON backup file.</p>
    <CsvUploader />
  </div>
)

const VerificationPage = () => (
  <Verification />
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
        <Route path="verification" element={<VerificationPage />} />
        <Route path="upload" element={<UploadPage />} />
        <Route path="central-database" element={<Reports />} />
        <Route path="statistics" element={<PopulationStatistics />} />
        <Route path="registration" element={<HouseholdForm />} />
        <Route path="settings" element={<Placeholder title="Settings" />} />
      </Route>
    </Routes>
  )
}

export default App
