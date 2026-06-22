const encoder = new TextEncoder()
const decoder = new TextDecoder()

function bytesToBase64(value) {
  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value)
  let binary = ''
  const chunkSize = 0x8000
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize))
  }
  return btoa(binary)
}

function base64ToBytes(value) {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return bytes
}

function bytesToHex(value) {
  return [...new Uint8Array(value)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

function parsePublicBundle(value) {
  const bundle = typeof value === 'string' ? JSON.parse(value) : value
  if (bundle?.v !== 1 || !bundle.encryption || !bundle.signing) throw new Error('Unsupported public key bundle')
  return bundle
}

async function importRsaPublic(jwk) {
  return crypto.subtle.importKey('jwk', jwk, { name: 'RSA-OAEP', hash: 'SHA-256' }, false, ['encrypt'])
}

async function importRsaPrivate(jwk) {
  return crypto.subtle.importKey('jwk', jwk, { name: 'RSA-OAEP', hash: 'SHA-256' }, false, ['decrypt'])
}

async function importSigningPrivate(jwk) {
  return crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign'])
}

async function importSigningPublic(jwk) {
  return crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify'])
}

export async function generateIdentity() {
  const encryption = await crypto.subtle.generateKey(
    { name: 'RSA-OAEP', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['encrypt', 'decrypt'],
  )
  const signing = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
  const publicBundle = {
    v: 1,
    encryption: await crypto.subtle.exportKey('jwk', encryption.publicKey),
    signing: await crypto.subtle.exportKey('jwk', signing.publicKey),
  }
  return {
    publicBundle: JSON.stringify(publicBundle),
    encryptionPrivate: await crypto.subtle.exportKey('jwk', encryption.privateKey),
    signingPrivate: await crypto.subtle.exportKey('jwk', signing.privateKey),
  }
}

async function encryptKeyForRecipients(aesKey, recipients) {
  const rawKey = await crypto.subtle.exportKey('raw', aesKey)
  const keys = {}
  for (const recipient of recipients) {
    const bundle = parsePublicBundle(recipient.publicKey)
    const publicKey = await importRsaPublic(bundle.encryption)
    keys[recipient.userId] = bytesToBase64(await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, publicKey, rawKey))
  }
  return keys
}

async function signPayload(payload, identity) {
  const key = await importSigningPrivate(identity.signingPrivate)
  return bytesToBase64(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, encoder.encode(payload)))
}

async function createEnvelope(bytes, kind, recipients, identity, metadata = {}) {
  const aesKey = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'])
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, bytes)
  const envelope = {
    v: 1,
    kind,
    alg: 'RSA-OAEP-256+A256GCM',
    iv: bytesToBase64(iv),
    keys: await encryptKeyForRecipients(aesKey, recipients),
    ...metadata,
  }
  if (kind === 'text') envelope.ciphertext = bytesToBase64(ciphertext)
  const serialized = JSON.stringify(envelope)
  return { envelope: serialized, signature: await signPayload(serialized, identity), ciphertext }
}

export async function encryptText(text, recipients, identity) {
  const result = await createEnvelope(encoder.encode(text), 'text', recipients, identity)
  return { encryptedContent: result.envelope, signature: result.signature }
}

export async function encryptFile(file, recipients, identity) {
  const result = await createEnvelope(await file.arrayBuffer(), 'file', recipients, identity, {
    fileName: file.name,
    fileMime: file.type || 'application/octet-stream',
  })
  return {
    encryptedContent: result.envelope,
    signature: result.signature,
    blob: new Blob([result.ciphertext], { type: 'application/octet-stream' }),
  }
}

async function decryptBytes(envelopeValue, ciphertextValue, userId, identity) {
  const envelope = typeof envelopeValue === 'string' ? JSON.parse(envelopeValue) : envelopeValue
  const encryptedKey = envelope.keys?.[userId]
  if (!encryptedKey) throw new Error('Message was not encrypted for this device')
  const privateKey = await importRsaPrivate(identity.encryptionPrivate)
  const rawKey = await crypto.subtle.decrypt({ name: 'RSA-OAEP' }, privateKey, base64ToBytes(encryptedKey))
  const aesKey = await crypto.subtle.importKey('raw', rawKey, 'AES-GCM', false, ['decrypt'])
  const ciphertext = ciphertextValue || base64ToBytes(envelope.ciphertext)
  return crypto.subtle.decrypt({ name: 'AES-GCM', iv: base64ToBytes(envelope.iv) }, aesKey, ciphertext)
}

export async function decryptText(encryptedContent, userId, identity) {
  return decoder.decode(await decryptBytes(encryptedContent, null, userId, identity))
}

export async function decryptFile(encryptedContent, encryptedBytes, userId, identity) {
  const envelope = JSON.parse(encryptedContent)
  const bytes = await decryptBytes(envelope, encryptedBytes, userId, identity)
  return new Blob([bytes], { type: envelope.fileMime || 'application/octet-stream' })
}

export async function verifyPayload(payload, signature, publicKeyValue) {
  try {
    const bundle = parsePublicBundle(publicKeyValue)
    const key = await importSigningPublic(bundle.signing)
    return crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, base64ToBytes(signature), encoder.encode(payload))
  } catch (_error) {
    return false
  }
}

export async function createKycProof(statement, identity) {
  const hash = await crypto.subtle.digest('SHA-256', encoder.encode(statement))
  return { hash: bytesToHex(hash), signature: await signPayload(bytesToHex(hash), identity) }
}

export async function createKycDocumentProof(details, documentFront, documentBack, identity) {
  const fileHash = async (file) => bytesToHex(await crypto.subtle.digest('SHA-256', await file.arrayBuffer()))
  const payload = JSON.stringify({
    fullName: details.fullName.trim(),
    citizenId: details.citizenId.trim(),
    dateOfBirth: details.dateOfBirth,
    address: details.address.trim(),
    frontHash: await fileHash(documentFront),
    backHash: await fileHash(documentBack),
  })
  return createKycProof(payload, identity)
}
