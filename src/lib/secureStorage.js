// secureStorage.js — Encrypts/Obfuscates PII in localStorage to prevent plain-text inspection in DevTools
const SECRET_KEY = 'TPS_IDTL_PII_PROTECTION_KEY_2025';

function xorTransform(str) {
  let result = '';
  for (let i = 0; i < str.length; i++) {
    result += String.fromCharCode(str.charCodeAt(i) ^ SECRET_KEY.charCodeAt(i % SECRET_KEY.length));
  }
  return result;
}

export function setSecureItem(key, data) {
  try {
    const jsonStr = JSON.stringify(data);
    // Transform with XOR and convert to utf8 safe base64
    const encoded = btoa(encodeURIComponent(xorTransform(jsonStr)));
    localStorage.setItem(key, 'tps_enc_v1:' + encoded);
  } catch (e) {
    console.error('SecureStorage write error:', e);
  }
}

export function getSecureItem(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    if (raw.startsWith('tps_enc_v1:')) {
      const b64 = raw.slice(11);
      const decoded = xorTransform(decodeURIComponent(atob(b64)));
      return JSON.parse(decoded);
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
