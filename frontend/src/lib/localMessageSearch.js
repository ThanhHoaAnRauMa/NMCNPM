function normalized(value) {
  return String(value || '').toLocaleLowerCase('vi')
}

export function containsSubstring(value, keyword) {
  const needle = normalized(keyword.trim())
  return Boolean(needle) && normalized(value).includes(needle)
}

export function highlightSubstring(value, keyword) {
  const text = String(value || '')
  const foldedText = normalized(text)
  const needle = normalized(keyword.trim())
  if (!needle) return [{ text, match: false }]

  const parts = []
  let cursor = 0
  let index = foldedText.indexOf(needle)
  while (index !== -1) {
    if (index > cursor) parts.push({ text: text.slice(cursor, index), match: false })
    parts.push({ text: text.slice(index, index + needle.length), match: true })
    cursor = index + needle.length
    index = foldedText.indexOf(needle, cursor)
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor), match: false })
  return parts.length ? parts : [{ text, match: false }]
}

export async function fetchAllConversationMessages(api, conversationId) {
  const byId = new Map()
  const visitedCursors = new Set()
  let before = null

  do {
    const query = new URLSearchParams({ limit: '100' })
    if (before) query.set('before', before)
    const payload = await api.get(`/chat/${conversationId}/messages?${query}`)
    for (const message of payload.messages || []) {
      const key = String(message._id || message.tempId || '')
      if (key) byId.set(key, message)
    }
    before = payload.nextCursor ? String(payload.nextCursor) : null
    if (before && visitedCursors.has(before)) throw new Error('Lịch sử trả về cursor lặp lại.')
    if (before) visitedCursors.add(before)
  } while (before)

  return [...byId.values()].sort((left, right) => {
    const timeDifference = new Date(left.createdAt || left.timestamp).getTime() - new Date(right.createdAt || right.timestamp).getTime()
    return timeDifference || String(left._id).localeCompare(String(right._id))
  })
}
