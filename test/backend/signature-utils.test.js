import assert from 'node:assert/strict'
import { webcrypto } from 'node:crypto'
import { createRequire } from 'node:module'
import test from 'node:test'

const require = createRequire(import.meta.url)
const { verifyEnvelopeSignature } = require('../../src/backend/src/utils/signature.utils.js')

async function signedPayload(payload) {
  const pair = await webcrypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
  const signing = await webcrypto.subtle.exportKey('jwk', pair.publicKey)
  const bytes = await webcrypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, pair.privateKey, new TextEncoder().encode(payload))
  return {
    publicBundle: JSON.stringify({ v: 1, encryption: { kty: 'RSA' }, signing }),
    signature: Buffer.from(bytes).toString('base64'),
  }
}

test('verifyEnvelopeSignature accepts the current device key and rejects tampering', async () => {
  const payload = JSON.stringify({ v: 1, ciphertext: 'ciphertext' })
  const signed = await signedPayload(payload)

  assert.equal(await verifyEnvelopeSignature(payload, signed.signature, signed.publicBundle), true)
  assert.equal(await verifyEnvelopeSignature(`${payload}x`, signed.signature, signed.publicBundle), false)
  assert.equal(await verifyEnvelopeSignature(payload, 'not base64!', signed.publicBundle), false)
})

