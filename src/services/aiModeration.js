import { generateGeminiText } from './geminiClient.js'
import { buildModerationPrompt, parseModerationJson } from './aiPrompts.js'

export const DEFAULT_MODERATION_TIMEOUT_MS = 5000
export const MAX_MODERATION_TIMEOUT_MS = 10000
export const MAX_MODERATION_TEXT_LENGTH = 4000

function normalizeModerationTimeout(value) {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 1) return DEFAULT_MODERATION_TIMEOUT_MS
  return Math.min(parsed, MAX_MODERATION_TIMEOUT_MS)
}

export async function moderatePlaintext(
  text,
  {
    generateText = generateGeminiText,
    timeoutMs = normalizeModerationTimeout(process.env.GEMINI_MODERATION_TIMEOUT_MS),
  } = {}
) {
  if (typeof text !== 'string' || !text.trim()) {
    const error = new Error('text is required')
    error.status = 400
    throw error
  }

  if (text.length > MAX_MODERATION_TEXT_LENGTH) {
    const error = new Error(`text must not exceed ${MAX_MODERATION_TEXT_LENGTH} characters`)
    error.status = 400
    throw error
  }

  try {
    const raw = await generateText(buildModerationPrompt(text.trim()), { timeoutMs })
    const result = parseModerationJson(raw)
    return {
      is_moderated: true,
      allowed: !result.harmful,
      harmful: result.harmful,
      categories: result.categories,
      warning: result.harmful
        ? result.warning || 'Message blocked by AI moderation.'
        : result.warning,
    }
  } catch (error) {
    return {
      is_moderated: false,
      allowed: true,
      harmful: false,
      categories: [],
      warning: '',
      error: 'moderation_unavailable',
    }
  }
}

export function createContentModerationMiddleware({
  getText = (req) => req.body?.text,
  setResult = (req, result) => {
    req.aiModeration = result
  },
  moderate = moderatePlaintext,
} = {}) {
  return async (req, res, next) => {
    try {
      const result = await moderate(getText(req))
      setResult(req, result)

      if (!result.allowed) {
        return res.status(422).json({
          error: 'message_blocked',
          moderation: result,
        })
      }

      return next()
    } catch (error) {
      if (error.status === 400) return res.status(400).json({ error: error.message })
      return next(error)
    }
  }
}
