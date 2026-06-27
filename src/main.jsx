import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import './index.css'
import { drainQueue, queueLength } from './lib/retryQueue.js'
import { pushNotification, NOTIF_TYPES } from './lib/notifications.js'

// Drain any queued writes on startup
if (navigator.onLine && queueLength() > 0) {
  const pending = queueLength();
  drainQueue().then(({ synced, failed }) => {
    if (synced > 0) {
      pushNotification({ type: NOTIF_TYPES.SYNC, title: 'Offline Records Synced', message: `${synced} record${synced > 1 ? 's' : ''} uploaded successfully.` });
    }
    if (failed > 0) {
      pushNotification({ type: NOTIF_TYPES.WARNING, title: 'Sync Partially Failed', message: `${failed} record${failed > 1 ? 's' : ''} could not be synced. Will retry.` });
    }
  });
} else if (!navigator.onLine && queueLength() > 0) {
  const q = queueLength();
  pushNotification({ type: NOTIF_TYPES.WARNING, title: 'Offline — Records Pending', message: `${q} record${q > 1 ? 's' : ''} queued for sync when online.` });
}

// Drain queue whenever device comes back online
window.addEventListener('online', () => {
  pushNotification({ type: NOTIF_TYPES.ONLINE, title: 'Back Online', message: 'Connection restored. Syncing pending records...' });
  drainQueue().then(({ synced, failed }) => {
    if (synced > 0) {
      pushNotification({ type: NOTIF_TYPES.SYNC, title: 'Sync Complete', message: `${synced} offline record${synced > 1 ? 's' : ''} uploaded.` });
    }
  });
});

window.addEventListener('offline', () => {
  // Offline notification disabled per user request
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)
