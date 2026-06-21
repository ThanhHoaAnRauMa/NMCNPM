import { describe, expect, it } from 'vitest'
import { encryptText, generateIdentity } from './crypto.js'
import { createEvidencePackage, verifyEvidencePackage } from './evidence.js'

describe('forensic evidence packages', () => {
  it('builds verifiable leaves, proofs and signatures', async () => {
    const identity = await generateIdentity()
    const senderId = '507f1f77bcf86cd799439011'
    const conversationId = '507f191e810c19729de860ea'
    const messages = []
    for (let index = 0; index < 3; index += 1) {
      const encrypted = await encryptText(`message ${index}`, [{ userId: senderId, publicKey: identity.publicBundle }], identity)
      messages.push({
        _id: `507f1f77bcf86cd7994390${index + 20}`,
        conversationId,
        senderId: { _id: senderId, publicKey: identity.publicBundle },
        createdAt: `2026-01-01T00:00:0${index}.000Z`,
        msgType: 'TEXT',
        plaintext: `message ${index}`,
        ...encrypted,
      })
    }
    const evidence = createEvidencePackage({ conversation: { _id: conversationId, type: 'DIRECT', mode: 'KYC' }, messages, roomId: `0x${'ab'.repeat(32)}` })
    const verification = await verifyEvidencePackage(evidence)
    expect(verification.valid).toBe(true)
    expect(evidence.messages).toHaveLength(3)
    expect(evidence.messages.every((message) => message.proof.length > 0)).toBe(true)
  })

  it('detects tampering', async () => {
    const identity = await generateIdentity()
    const encrypted = await encryptText('original', [{ userId: 'user-1', publicKey: identity.publicBundle }], identity)
    const evidence = createEvidencePackage({
      conversation: { _id: 'conversation-1', type: 'DIRECT', mode: 'KYC' },
      roomId: `0x${'cd'.repeat(32)}`,
      messages: [{ _id: 'message-1', conversationId: 'conversation-1', senderId: { _id: 'user-1', publicKey: identity.publicBundle }, createdAt: '2026-01-01T00:00:00.000Z', ...encrypted }],
    })
    evidence.messages[0].encryptedContent += 'tampered'
    expect((await verifyEvidencePackage(evidence)).valid).toBe(false)
  })
})
