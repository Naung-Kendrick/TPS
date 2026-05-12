// notifications.js — lightweight client-side notification store
// Persists to localStorage; dispatches a custom event so any component can react

const STORE_KEY = 'tps_notifications';
const MAX_NOTIFICATIONS = 50;

export const NOTIF_TYPES = {
  SYNC:         'sync',
  UPLOAD:       'upload',
  VERIFICATION: 'verification',
  ONLINE:       'online',
  OFFLINE:      'offline',
  INFO:         'info',
  WARNING:      'warning',
  ERROR:        'error',
};

function load() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY) || '[]'); } catch (_) { return []; }
}

function save(list) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(list)); } catch (_) {}
}

function dispatch() {
  window.dispatchEvent(new CustomEvent('tps:notifications'));
}

export function pushNotification({ type = NOTIF_TYPES.INFO, title, message }) {
  const list = load();
  const notif = {
    id: crypto.randomUUID(),
    type,
    title,
    message: message || '',
    timestamp: new Date().toISOString(),
    read: false,
  };
  const updated = [notif, ...list].slice(0, MAX_NOTIFICATIONS);
  save(updated);
  dispatch();
  return notif;
}

export function getNotifications() {
  return load();
}

export function getUnreadCount() {
  return load().filter(n => !n.read).length;
}

export function markAllRead() {
  const updated = load().map(n => ({ ...n, read: true }));
  save(updated);
  dispatch();
}

export function markRead(id) {
  const updated = load().map(n => n.id === id ? { ...n, read: true } : n);
  save(updated);
  dispatch();
}

export function clearAll() {
  save([]);
  dispatch();
}
