export const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash'
export const DEFAULT_GEMINI_TIMEOUT_MS = 10000

function normalizeTimeout(value, fallback = DEFAULT_GEMINI_TIMEOUT_MS) {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 1) return fallback
  return parsed
}

function extractText(payload) {
  const parts = payload?.candidates?.[0]?.content?.parts
  if (!Array.isArray(parts)) return ''
  return parts
    .map((part) => (typeof part.text === 'string' ? part.text : ''))
    .join('')
    .trim()
}

export async function generateGeminiText(
  prompt,
  {
    apiKey = process.env.GEMINI_API_KEY,
    model = process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL,
    timeoutMs = normalizeTimeout(process.env.GEMINI_TIMEOUT_MS),
    fetchImpl = globalThis.fetch,
  } = {}
) {
  if (!apiKey || apiKey.includes('replace_with')) {
    const error = new Error('GEMINI_API_KEY is not configured')
    error.code = 'AI_PROVIDER_NOT_CONFIGURED'
    throw error
  }

  if (typeof fetchImpl !== 'function') {
    const error = new Error('fetch is not available in this runtime')
    error.code = 'AI_FETCH_NOT_AVAILABLE'
    throw error
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), normalizeTimeout(timeoutMs))
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model
  )}:generateContent`

  try {
    const response = await fetchImpl(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 768,
        },
      }),
      signal: controller.signal,
    })

    if (!response.ok) {
      const error = new Error(`Gemini request failed with status ${response.status}`)
      error.code = 'AI_PROVIDER_ERROR'
      error.status = response.status
      throw error
    }

    const payload = await response.json()
    const text = extractText(payload)
    if (!text) {
      const error = new Error('Gemini returned an empty response')
      error.code = 'AI_EMPTY_RESPONSE'
      throw error
    }

    return text
  } catch (error) {
    if (error.name === 'AbortError') {
      const timeoutError = new Error('Gemini request timed out')
      timeoutError.code = 'AI_TIMEOUT'
      throw timeoutError
    }
    throw error
  } finally {
    clearTimeout(timeout)
  }
}
