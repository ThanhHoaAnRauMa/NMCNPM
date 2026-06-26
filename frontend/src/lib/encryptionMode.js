export const DECRYPT_MESSAGES = String(import.meta.env.VITE_DECRYPT_MESSAGES ?? 'true').toLowerCase() !== 'false'

function compactJson(value) {
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value
    return JSON.stringify(parsed, null, 2)
  } catch (_error) {
    return String(value || '')
  }
}

export function encryptedPreview(encryptedContent, { maxLength = 1200 } = {}) {
  const text = compactJson(encryptedContent)
  const clipped = text.length > maxLength ? `${text.slice(0, maxLength)}\n...` : text
  return `ENCRYPTED CONTENT\n${clipped}`
}
