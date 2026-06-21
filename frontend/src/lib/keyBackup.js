const encoder = new TextEncoder()
const decoder = new TextDecoder()
const ITERATIONS = 310000

function toBase64(value) {
  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value)
  let binary = ''
  for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000))
  return btoa(binary)
}

function fromBase64(value) {
  const binary = atob(value)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

async function deriveKey(password, salt, usage) {
  const material = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITERATIONS },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    [usage],
  )
}

function validateIdentity(identity) {
  if (!identity || typeof identity.publicBundle !== 'string' || !identity.encryptionPrivate || !identity.signingPrivate) {
    throw new Error('The backup does not contain a valid device identity.')
  }
  const bundle = JSON.parse(identity.publicBundle)
  if (bundle?.v !== 1 || !bundle.encryption || !bundle.signing) throw new Error('Unsupported public key bundle.')
  return identity
}

export async function createIdentityBackup(userId, identity, password) {
  if (typeof password !== 'string' || password.length < 12) throw new Error('Backup password must contain at least 12 characters.')
  validateIdentity(identity)
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveKey(password, salt, 'encrypt')
  const payload = encoder.encode(JSON.stringify({ userId: String(userId), identity }))
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, payload)
  return JSON.stringify({
    format: 'secure-chat-device-key', version: 1, createdAt: new Date().toISOString(),
    kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations: ITERATIONS, salt: toBase64(salt) },
    cipher: { name: 'AES-GCM', iv: toBase64(iv), ciphertext: toBase64(ciphertext) },
  }, null, 2)
}

export async function restoreIdentityBackup(serialized, password, expectedUserId) {
  if (typeof password !== 'string' || password.length < 12) throw new Error('Backup password must contain at least 12 characters.')
  let backup
  try { backup = JSON.parse(serialized) } catch (_error) { throw new Error('Backup file is not valid JSON.') }
  if (backup?.format !== 'secure-chat-device-key' || backup.version !== 1 || backup.kdf?.iterations !== ITERATIONS) {
    throw new Error('Unsupported device-key backup format.')
  }
  try {
    const salt = fromBase64(backup.kdf.salt)
    const iv = fromBase64(backup.cipher.iv)
    const key = await deriveKey(password, salt, 'decrypt')
    const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, fromBase64(backup.cipher.ciphertext))
    const payload = JSON.parse(decoder.decode(plaintext))
    if (String(payload.userId) !== String(expectedUserId)) throw new Error('This backup belongs to a different account.')
    return validateIdentity(payload.identity)
  } catch (error) {
    if (error.message?.includes('different account')) throw error
    throw new Error('Cannot decrypt backup. Check the file and password.')
  }
}
