import { describe, expect, test } from 'vitest'
import { createKycDocumentProof, generateIdentity, verifyPayload } from './crypto.js'

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
