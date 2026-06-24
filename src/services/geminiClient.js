export const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash'
export const DEFAULT_GEMINI_TIMEOUT_MS = 10000
export const DEFAULT_GEMINI_RETRIES = 2

function normalizeTimeout(value, fallback = DEFAULT_GEMINI_TIMEOUT_MS) {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 1) return fallback
  return parsed
}

function normalizeOutputTokens(value, fallback = 768) {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 1) return fallback
  return Math.min(parsed, 8192)
}

function extractText(payload) {
  const parts = payload?.candidates?.[0]?.content?.parts
  if (!Array.isArray(parts)) return ''
  return parts
    .map((part) => (typeof part.text === 'string' ? part.text : ''))
    .join('')
    .trim()
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function normalizeRetries(value, fallback = DEFAULT_GEMINI_RETRIES) {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 0) return fallback
  return Math.min(parsed, 5)
}

function parseRetryAfter(value) {
  const seconds = Number(value)
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1000, 3000)
  return null
}

function providerErrorCode(status, payload) {
  const providerStatus = payload?.error?.status
  if (status === 429 || providerStatus === 'RESOURCE_EXHAUSTED') return 'AI_PROVIDER_RATE_LIMITED'
  if (status === 503 || providerStatus === 'UNAVAILABLE') return 'AI_PROVIDER_UNAVAILABLE'
  return 'AI_PROVIDER_ERROR'
}

export async function generateGeminiText(
  prompt,
  {
    apiKey = process.env.GEMINI_API_KEY,
    model = process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL,
    timeoutMs = normalizeTimeout(process.env.GEMINI_TIMEOUT_MS),
    maxOutputTokens = 768,
    thinkingBudget = 0,
    retries = normalizeRetries(process.env.GEMINI_RETRIES),
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

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model
  )}:generateContent`

  for (let attempt = 0; attempt <= normalizeRetries(retries); attempt += 1) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), normalizeTimeout(timeoutMs))
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
          maxOutputTokens: normalizeOutputTokens(maxOutputTokens),
          thinkingConfig: { thinkingBudget },
        },
      }),
      signal: controller.signal,
    })

    if (!response.ok) {
      const payload = await response.json().catch(() => null)
      const error = new Error(`Gemini request failed with status ${response.status}`)
      error.code = providerErrorCode(response.status, payload)
      error.status = response.status
      error.providerStatus = payload?.error?.status
      error.providerMessage = payload?.error?.message
      const retryAfter = parseRetryAfter(response.headers?.get?.('retry-after'))
      if (attempt < normalizeRetries(retries) && error.code === 'AI_PROVIDER_UNAVAILABLE') {
        clearTimeout(timeout)
        await sleep(retryAfter ?? 500 * (attempt + 1))
        continue
      }
      throw error
    }

    const payload = await response.json()
    const text = extractText(payload)
    if (payload?.candidates?.[0]?.finishReason === 'MAX_TOKENS') {
      const error = new Error('Gemini response reached the output token limit')
      error.code = 'AI_TRUNCATED_RESPONSE'
      throw error
    }
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
    if (attempt < normalizeRetries(retries) && error.code === 'AI_PROVIDER_UNAVAILABLE') {
      clearTimeout(timeout)
      await sleep(500 * (attempt + 1))
      continue
    }
    throw error
  } finally {
    clearTimeout(timeout)
  }
  }
}
