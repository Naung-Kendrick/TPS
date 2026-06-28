// secureStorage.js — Runtime-derived dynamic obfuscation for localStorage PII
function getDynamicKey() {
  try {
    const anon = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
    const host = typeof window !== 'undefined' ? window.location.host : 'tps';
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 20) : 'idtl';
    return (anon + host + ua).split('').reverse().join('');
  } catch (_) {
    return 'TPS_DYNAMIC_KEY_FALLBACK_2025';
  }
}

function xorTransform(str) {
  const key = getDynamicKey();
  let result = '';
  for (let i = 0; i < str.length; i++) {
    result += String.fromCharCode(str.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return result;
}

export function setSecureItem(key, data) {
  try {
    const jsonStr = JSON.stringify(data);
    const encoded = btoa(encodeURIComponent(xorTransform(jsonStr)));
    localStorage.setItem(key, 'tps_enc_v2:' + encoded);
  } catch (e) {
    console.error('SecureStorage write error:', e);
  }
}

export function getSecureItem(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    if (raw.startsWith('tps_enc_v2:')) {
      const b64 = raw.slice(11);
      const decoded = xorTransform(decodeURIComponent(atob(b64)));
      return JSON.parse(decoded);
    }
    if (raw.startsWith('tps_enc_v1:')) {
      // Legacy fallback for v1
      const legacyKey = 'TPS_IDTL_PII_PROTECTION_KEY_2025';
      const b64 = raw.slice(11);
      let legacyDecoded = '';
      const str = decodeURIComponent(atob(b64));
      for (let i = 0; i < str.length; i++) {
        legacyDecoded += String.fromCharCode(str.charCodeAt(i) ^ legacyKey.charCodeAt(i % legacyKey.length));
      }
      return JSON.parse(legacyDecoded);
    }
    // Fallback for legacy plain-text JSON
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

export function removeSecureItem(key) {
  try {
    localStorage.removeItem(key);
  } catch (e) {}
}
