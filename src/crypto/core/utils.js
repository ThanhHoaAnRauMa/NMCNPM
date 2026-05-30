/**
 * core/utils.js
 * Các hàm tiện ích dùng chung cho toàn bộ crypto layer.
 */

export const CryptoUtils = {
  /** ArrayBuffer / Uint8Array → hex string */
  toHex(buffer) {
    return Array.from(new Uint8Array(buffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  },

  /** hex string → Uint8Array */
  fromHex(hex) {
    const arr = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2)
      arr[i / 2] = parseInt(hex.slice(i, i + 2), 16);
    return arr;
  },

  /** ArrayBuffer → Base64 */
  toBase64(buffer) {
    return btoa(String.fromCharCode(...new Uint8Array(buffer)));
  },

  /** Base64 → Uint8Array */
  fromBase64(b64) {
    return Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  },

  /** string → ArrayBuffer */
  encode(str) {
    return new TextEncoder().encode(str);
  },

  /** ArrayBuffer → string */
  decode(buffer) {
    return new TextDecoder().decode(buffer);
  },

  /** Tạo random bytes an toàn */
  randomBytes(length) {
    return crypto.getRandomValues(new Uint8Array(length));
  },

  /** Ghép nhiều Uint8Array thành một */
  concat(...arrays) {
    const total = arrays.reduce((s, a) => s + a.length, 0);
    const out = new Uint8Array(total);
    let offset = 0;
    for (const a of arrays) { out.set(a, offset); offset += a.length; }
    return out;
  },
};
