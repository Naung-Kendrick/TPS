import { useState } from 'react'
import CsvUploader from './components/CsvUploader'
import HouseholdTable from './components/HouseholdTable'
import './App.css'

function App() {
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  const handleUploadSuccess = () => {
    // Increment the trigger to force the table to fetch new data
    setRefreshTrigger(prev => prev + 1)
  }

  return (
    <div className="container" style={{ maxWidth: '1000px' }}>
      <h1>Household Management System</h1>
      
      <div style={{ marginBottom: '2rem', padding: '1.5rem', background: 'rgba(0,0,0,0.1)', borderRadius: '8px' }}>
        <CsvUploader onUploadSuccess={handleUploadSuccess} />
      </div>

      <HouseholdTable refreshTrigger={refreshTrigger} />
    </div>
  )
}

export default App
