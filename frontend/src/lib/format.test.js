import { describe, expect, it } from 'vitest'
import { conversationTitle, fileSize, userId } from './format.js'

describe('format helpers', () => {
  it('resolves direct conversation titles from the other member', () => {
    expect(conversationTitle({ type: 'DIRECT', members: [{ _id: 'me', username: 'Me' }, { _id: 'other', displayName: 'Hoa' }] }, 'me')).toBe('Hoa')
  })

  it('normalizes ids and file sizes', () => {
    expect(userId({ id: 'abc' })).toBe('abc')
    expect(fileSize(1536)).toBe('1.5 KB')
  })
})
