import { describe, expect, it } from 'vitest'
import { conversationPeer, conversationTitle, fileSize, isKycVerified, userId } from './format.js'

describe('format helpers', () => {
  it('resolves direct conversation titles from the other member', () => {
    expect(conversationTitle({ type: 'DIRECT', members: [{ _id: 'me', username: 'Me' }, { _id: 'other', displayName: 'Hoa' }] }, 'me')).toBe('Hoa')
  })

  it('normalizes ids and file sizes', () => {
    expect(userId({ id: 'abc' })).toBe('abc')
    expect(fileSize(1536)).toBe('1.5 KB')
  })

  it('detects verified KYC status case-insensitively', () => {
    expect(isKycVerified({ kycStatus: 'VERIFIED' })).toBe(true)
    expect(isKycVerified({ kycStatus: 'verified' })).toBe(true)
    expect(isKycVerified({ kycStatus: 'PENDING' })).toBe(false)
  })

  it('resolves the other direct conversation participant for account badges', () => {
    const conversation = { type: 'DIRECT', members: [{ _id: 'me' }, { _id: 'other', username: 'bob' }] }
    expect(conversationPeer(conversation, 'me')?.username).toBe('bob')
    expect(conversationPeer({ type: 'GROUP', members: conversation.members }, 'me')).toBeNull()
  })
})
