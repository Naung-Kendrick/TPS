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

// ── Notification Sounds (Web Audio API — no files needed) ──────────────────

let _audioCtx = null;

function getAudioCtx() {
  if (!_audioCtx) {
    try { _audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (_) {}
  }
  return _audioCtx;
}

function playTone({ freq = 440, freq2 = null, type = 'sine', volume = 0.18, duration = 0.12, delay = 0, decay = 0.08 }) {
  const ctx = getAudioCtx();
  if (!ctx) return;
  try {
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (freq2) osc.frequency.linearRampToValueAtTime(freq2, t + duration);
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration + decay);
    osc.start(t);
    osc.stop(t + duration + decay + 0.01);
  } catch (_) {}
}

function playSound(type) {
  switch (type) {
    case NOTIF_TYPES.UPLOAD:
    case NOTIF_TYPES.SYNC:
      // Rising two-tone chime — success feeling
      playTone({ freq: 520, freq2: 780, type: 'sine', volume: 0.15, duration: 0.14, decay: 0.10 });
      playTone({ freq: 780, freq2: 1040, type: 'sine', volume: 0.10, duration: 0.12, delay: 0.13, decay: 0.12 });
      break;
    case NOTIF_TYPES.ONLINE:
      // Bright rising ping
      playTone({ freq: 600, freq2: 900, type: 'sine', volume: 0.14, duration: 0.16, decay: 0.14 });
      break;
    case NOTIF_TYPES.VERIFICATION:
      // Single clean mid-tone ping
      playTone({ freq: 880, type: 'sine', volume: 0.14, duration: 0.08, decay: 0.18 });
      break;
    case NOTIF_TYPES.WARNING:
      // Double low pulse — attention
      playTone({ freq: 320, type: 'triangle', volume: 0.18, duration: 0.10, decay: 0.06 });
      playTone({ freq: 280, type: 'triangle', volume: 0.15, duration: 0.10, delay: 0.16, decay: 0.08 });
      break;
    case NOTIF_TYPES.OFFLINE:
    case NOTIF_TYPES.ERROR:
      // Descending tone — problem
      playTone({ freq: 440, freq2: 260, type: 'triangle', volume: 0.18, duration: 0.20, decay: 0.10 });
      break;
    case NOTIF_TYPES.INFO:
    default:
      // Very short soft tick
      playTone({ freq: 660, type: 'sine', volume: 0.10, duration: 0.05, decay: 0.06 });
      break;
  }
}

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
  playSound(type);
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
