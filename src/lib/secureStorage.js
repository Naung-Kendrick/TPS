// secureStorage.js — Session-scoped CSPRNG protection for client storage

const SESSION_PII_KEYS = new Set([
  'tps_household_form_draft',
  'tps_retry_queue',
  'tps_backup_history_logs',
]);

const SESSION_KEY_STORAGE = 'tps_session_cipher_key';
let _memorySessionKey = null;

function getStorageBackend(key) {
  if (typeof window === 'undefined') return null;
  return SESSION_PII_KEYS.has(key) ? window.sessionStorage : window.localStorage;
}

function getSessionRandomKey() {
  if (_memorySessionKey) return _memorySessionKey;
  try {
    const existing = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(SESSION_KEY_STORAGE) : null;
    if (existing && existing.length >= 32) {
      _memorySessionKey = existing;
      return _memorySessionKey;
    }
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    _memorySessionKey = hex;
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(SESSION_KEY_STORAGE, hex);
    }
    return _memorySessionKey;
  } catch (_) {
    // Ephemeral fallback if sessionStorage is blocked
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    _memorySessionKey = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    return _memorySessionKey;
  }
}

function getFallbackLegacyKey() {
  try {
    const anon = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
    const host = typeof window !== 'undefined' ? window.location.host : 'tps';
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 20) : 'idtl';
    return (anon + host + ua).split('').reverse().join('');
  } catch (_) {
    return 'TPS_DYNAMIC_KEY_FALLBACK_2025';
  }
}

function xorWithKey(str, key) {
  let result = '';
  for (let i = 0; i < str.length; i++) {
    result += String.fromCharCode(str.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return result;
}

export function setSecureItem(key, data) {
  try {
    const backend = getStorageBackend(key);
    if (!backend) return;
    const jsonStr = JSON.stringify(data);
    const secret = SESSION_PII_KEYS.has(key) ? getSessionRandomKey() : getFallbackLegacyKey();
    const prefix = SESSION_PII_KEYS.has(key) ? 'tps_enc_v3:' : 'tps_enc_v2:';
    const encoded = btoa(encodeURIComponent(xorWithKey(jsonStr, secret)));
    backend.setItem(key, prefix + encoded);
    // Clean up any stale legacy localStorage copy when key belongs in sessionStorage
    if (SESSION_PII_KEYS.has(key)) {
      try { localStorage.removeItem(key); } catch (_) {}
    }
  } catch (_) {}
}

export function getSecureItem(key) {
  try {
    const backend = getStorageBackend(key);
    if (!backend) return null;
    if (SESSION_PII_KEYS.has(key)) {
      try { localStorage.removeItem(key); } catch (_) {}
    }
    const raw = backend.getItem(key);
    if (!raw) return null;
    if (raw.startsWith('tps_enc_v3:')) {
      const b64 = raw.slice(11);
      const decoded = xorWithKey(decodeURIComponent(atob(b64)), getSessionRandomKey());
      return JSON.parse(decoded);
    }
    if (raw.startsWith('tps_enc_v2:')) {
      const b64 = raw.slice(11);
      const decoded = xorWithKey(decodeURIComponent(atob(b64)), getFallbackLegacyKey());
      return JSON.parse(decoded);
    }
    if (raw.startsWith('tps_enc_v1:')) {
      const b64 = raw.slice(11);
      const decoded = xorWithKey(decodeURIComponent(atob(b64)), 'TPS_IDTL_PII_PROTECTION_KEY_2025');
      return JSON.parse(decoded);
    }
    return JSON.parse(raw);
  } catch (_) {
    return null;
  }
}

export function removeSecureItem(key) {
  try {
    localStorage.removeItem(key);
  } catch (_) {}
  try {
    sessionStorage.removeItem(key);
  } catch (_) {}
}
