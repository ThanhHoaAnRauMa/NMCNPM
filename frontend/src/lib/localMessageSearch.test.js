import { describe, expect, it, vi } from 'vitest'
import { containsSubstring, fetchAllConversationMessages, highlightSubstring } from './localMessageSearch.js'

describe('local message substring search', () => {
  it('matches a case-insensitive substring and highlights every occurrence', () => {
    expect(containsSubstring('Xin chào Ông Nội', 'ông n')).toBe(true)
    expect(containsSubstring('secure message', 'cure')).toBe(true)
    expect(containsSubstring('secure message', 'other')).toBe(false)
    expect(highlightSubstring('alo ALO', 'alo')).toEqual([
      { text: 'alo', match: true },
      { text: ' ', match: false },
      { text: 'ALO', match: true },
    ])
  })

  it('loads, deduplicates and chronologically sorts every history page', async () => {
    const get = vi.fn()
      .mockResolvedValueOnce({ messages: [{ _id: '3', createdAt: '2026-01-03' }, { _id: '2', createdAt: '2026-01-02' }], nextCursor: '2' })
      .mockResolvedValueOnce({ messages: [{ _id: '2', createdAt: '2026-01-02' }, { _id: '1', createdAt: '2026-01-01' }], nextCursor: null })

    const messages = await fetchAllConversationMessages({ get }, 'conversation-1')

    expect(get).toHaveBeenCalledTimes(2)
    expect(get.mock.calls[1][0]).toContain('before=2')
    expect(messages.map((message) => message._id)).toEqual(['1', '2', '3'])
  })
})

