import { describe, expect, test } from 'vitest'
import { createKycDocumentProof, decryptText, encryptText, generateIdentity, verifyPayload } from './crypto.js'

describe('KYC document proof', () => {
  test('binds normalized identity fields and both document images to the device signature', async () => {
    const identity = await generateIdentity()
    const details = {
      fullName: '  Nguyen Van Alice  ',
      citizenId: '012345678901',
      dateOfBirth: '2000-01-02',
      address: '  123 Test Street  ',
    }
    const proof = await createKycDocumentProof(
      details,
      new Blob(['front-image'], { type: 'image/png' }),
      new Blob(['back-image'], { type: 'image/png' }),
      identity,
    )

    expect(proof.hash).toMatch(/^[a-f0-9]{64}$/)
    expect(await verifyPayload(proof.hash, proof.signature, identity.publicBundle)).toBe(true)
    expect(await verifyPayload(`${proof.hash}0`, proof.signature, identity.publicBundle)).toBe(false)
  })
})

describe('chat encryption', () => {
  test('uses a rotated AES-GCM session envelope without exposing plaintext', async () => {
    const alice = await generateIdentity()
    const bob = await generateIdentity()
    const recipients = [
      { userId: 'alice', publicKey: alice.publicBundle },
      { userId: 'bob', publicKey: bob.publicBundle },
    ]

    const first = await encryptText('hello bob', recipients, alice, { conversationId: 'conversation-1' })
    const second = await encryptText('second message', recipients, alice, { conversationId: 'conversation-1' })
    const firstEnvelope = JSON.parse(first.encryptedContent)
    const secondEnvelope = JSON.parse(second.encryptedContent)

    expect(firstEnvelope.v).toBe(2)
    expect(firstEnvelope.sessionId).toBe(secondEnvelope.sessionId)
    expect(firstEnvelope.iv).not.toBe(secondEnvelope.iv)
    expect(first.encryptedContent).not.toContain('hello bob')
    expect(await decryptText(first.encryptedContent, 'bob', bob)).toBe('hello bob')
    expect(await verifyPayload(first.encryptedContent, first.signature, alice.publicBundle)).toBe(true)
  })
})
