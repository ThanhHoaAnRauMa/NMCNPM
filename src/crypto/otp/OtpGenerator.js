/**
 * otp/OtpGenerator.js
 * TOTP (time-based) và HOTP (counter-based) theo RFC 6238 / 4226.
 * OtpFactory cho phép thêm EmailOtp, SmsOtp wrapper sau này.
 */

import { IOTPGenerator } from '../core/interfaces.js';
import { CryptoUtils } from '../core/utils.js';

/* ── Numeric OTP thuần (không cần secret HMAC) ────────── */
export class NumericOtpGenerator extends IOTPGenerator {
  /**
   * Sinh OTP ngẫu nhiên N chữ số.
   * @param {{ digits?: number }} options
   */
  generate({ digits = 6 } = {}) {
    const max = 10 ** digits;
    const rand = crypto.getRandomValues(new Uint32Array(1))[0];
    return String(rand % max).padStart(digits, '0');
  }

  /** Verify bằng constant-time compare */
  verify(otp, expected) {
    if (otp.length !== expected.length) return false;
    let diff = 0;
    for (let i = 0; i < otp.length; i++)
      diff |= otp.charCodeAt(i) ^ expected.charCodeAt(i);
    return diff === 0;
  }
}

/* ── HOTP (HMAC-based OTP) ────────────────────────────── */
export class HotpGenerator extends IOTPGenerator {
  constructor({ digits = 6, algorithm = 'SHA-1' } = {}) {
    super();
    this.digits = digits;
    this.algorithm = algorithm;
  }

  /** Base32 decode đơn giản cho secret */
  #base32Decode(secret) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let bits = 0, value = 0;
    const output = [];
    for (const c of secret.toUpperCase().replace(/=+$/, '')) {
      value = (value << 5) | chars.indexOf(c);
      bits += 5;
      if (bits >= 8) { output.push((value >>> (bits - 8)) & 0xff); bits -= 8; }
    }
    return new Uint8Array(output);
  }

  async generate({ secret, counter = 0 } = {}) {
    const keyBytes = typeof secret === 'string' ? this.#base32Decode(secret) : secret;
    const key = await crypto.subtle.importKey(
      'raw', keyBytes,
      { name: 'HMAC', hash: this.algorithm },
      false, ['sign'],
    );
    // counter → 8-byte big-endian
    const msg = new Uint8Array(8);
    let c = counter;
    for (let i = 7; i >= 0; i--) { msg[i] = c & 0xff; c >>= 8; }

    const sig = await crypto.subtle.sign('HMAC', key, msg);
    const arr = new Uint8Array(sig);
    const offset = arr[arr.length - 1] & 0x0f;
    const code = ((arr[offset] & 0x7f) << 24)
      | (arr[offset + 1] << 16)
      | (arr[offset + 2] << 8)
      | arr[offset + 3];
    return String(code % (10 ** this.digits)).padStart(this.digits, '0');
  }

  async verify({ secret, counter, otp, window: w = 1 }) {
    for (let i = counter - w; i <= counter + w; i++) {
      const expected = await this.generate({ secret, counter: i });
      if (otp === expected) return true;
    }
    return false;
  }
}

/* ── TOTP (Time-based OTP) ────────────────────────────── */
export class TotpGenerator extends HotpGenerator {
  constructor({ digits = 6, period = 30, algorithm = 'SHA-1' } = {}) {
    super({ digits, algorithm });
    this.period = period; // giây, thường 30
  }

  #getCounter(time = Date.now()) {
    return Math.floor(time / 1000 / this.period);
  }

  async generate({ secret } = {}) {
    return super.generate({ secret, counter: this.#getCounter() });
  }

  async verify({ secret, otp, window: w = 1 }) {
    const counter = this.#getCounter();
    return super.verify({ secret, counter, otp, window: w });
  }
}

/* ── Factory ───────────────────────────────────────────── */
export class OtpFactory {
  static #registry = new Map([
    ['NUMERIC', () => new NumericOtpGenerator()],
    ['HOTP',   (opts) => new HotpGenerator(opts)],
    ['TOTP',   (opts) => new TotpGenerator(opts)],
  ]);

  static create(type = 'TOTP', options = {}) {
    const factory = this.#registry.get(type.toUpperCase());
    if (!factory) throw new Error(`Unknown OTP type: ${type}`);
    return factory(options);
  }

  static register(type, factory) {
    this.#registry.set(type.toUpperCase(), factory);
  }
}
