import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import './index.css'
import { drainQueue, queueLength } from './lib/retryQueue.js'

// Drain any queued writes on startup
if (navigator.onLine && queueLength() > 0) {
  drainQueue().then(({ synced }) => {
    if (synced > 0) console.log(`[TPS] Synced ${synced} offline record(s) to Supabase.`);
  });
}

// Drain queue whenever device comes back online
window.addEventListener('online', () => {
  drainQueue().then(({ synced }) => {
    if (synced > 0) console.log(`[TPS] Back online — synced ${synced} record(s).`);
  });
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)
