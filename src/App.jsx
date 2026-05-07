import { Routes, Route, Navigate } from 'react-router-dom'
import { useState } from 'react'
import Layout from './components/layout/Layout'
import CsvUploader from './components/CsvUploader'
import Verification from './components/Verification'
import Reports from './components/Reports'
import './App.css'

const VerificationPage = () => {
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  
  return (
    <div style={{ padding: '2rem' }} className="max-w-7xl mx-auto">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', margin: '0 0 0.5rem 0', color: 'var(--text-primary)' }}>Data Verification</h2>
          <p style={{ margin: 0, color: 'var(--text-secondary)' }}>Strictly verify household members.</p>
        </div>
      </div>

      <CsvUploader onUploadSuccess={() => setRefreshTrigger(prev => prev + 1)} />

      <Verification key={refreshTrigger} />
    </div>
  )
}

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
        <Route path="reports" element={<Reports />} />
        <Route path="statistics" element={<Placeholder title="Population Statistics" />} />
        <Route path="settings" element={<Placeholder title="Settings" />} />
      </Route>
    </Routes>
  )
}

export default App
