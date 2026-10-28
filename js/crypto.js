// Content is sealed by tools/build.mjs: PBKDF2-SHA256 key from the date code, AES-256-GCM per file.
// File layout: 12-byte IV, then ciphertext with the GCM tag appended (what WebCrypto expects).

const enc = new TextEncoder();
const fromB64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));

export async function deriveKey(code, saltB64, iterations) {
  const base = await crypto.subtle.importKey('raw', enc.encode(code), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: fromB64(saltB64), iterations, hash: 'SHA-256' },
    base, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
}

export async function decrypt(key, buf) {
  const bytes = new Uint8Array(buf);
  return crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes.slice(0, 12) }, key, bytes.slice(12));
}
