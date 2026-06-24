import crypto from 'crypto'
import express from 'express'
import mongoose from 'mongoose'

import AISummaryCache, { AI_SUMMARY_CACHE_TTL_SECONDS } from '../db/models/aiSummaryCache.js'
import Message from '../db/models/message.js'
import { buildSummaryPrompt } from '../services/aiPrompts.js'
import { generateGeminiText, DEFAULT_GEMINI_MODEL } from '../services/geminiClient.js'
import { moderatePlaintext } from '../services/aiModeration.js'

const MAX_SUMMARY_MESSAGES = Number(process.env.AI_MAX_SUMMARY_MESSAGES) || 100
const MAX_MESSAGE_TEXT_LENGTH = Number(process.env.AI_MAX_MESSAGE_CHARS) || 4000
const MAX_TOTAL_TEXT_LENGTH = Number(process.env.AI_MAX_TOTAL_CHARS) || 20000
const SUMMARY_PROMPT_VERSION = 2

function requestError(message, status = 400) {
  const error = new Error(message)
  error.status = status
  return error
}

function toObjectId(value, fieldName) {
  if (typeof value !== 'string' || !/^[a-f0-9]{24}$/i.test(value)) {
    throw requestError(`${fieldName} must be a valid ObjectId`)
  }
  return new mongoose.Types.ObjectId(value)
}

function normalizeSummaryPayload(body) {
  const conversationId = toObjectId(body?.conversationId, 'conversationId')
  const plaintextMessages = Array.isArray(body?.messages) ? body.messages : []

  if (!plaintextMessages.length) {
    throw requestError('messages plaintext array is required')
  }

  if (plaintextMessages.length > MAX_SUMMARY_MESSAGES) {
    throw requestError(`messages must not exceed ${MAX_SUMMARY_MESSAGES} items`)
  }

  const providedMessageIds = Array.isArray(body?.messageIds) && body.messageIds.length
    ? body.messageIds
    : plaintextMessages.map((message) => message?.messageId)

  if (providedMessageIds.length !== plaintextMessages.length) {
    throw requestError('messageIds length must match messages length')
  }

  const byId = new Map()
  let totalLength = 0

  for (const message of plaintextMessages) {
    const messageId = typeof message?.messageId === 'string' ? message.messageId : ''
    if (!messageId) throw requestError('messages[].messageId is required')
    if (byId.has(messageId)) throw requestError('messages[].messageId must be unique')

    const text = typeof message?.text === 'string' ? message.text.trim() : ''
    if (!text) throw requestError('messages[].text is required')
    if (text.length > MAX_MESSAGE_TEXT_LENGTH) {
      throw requestError(`messages[].text must not exceed ${MAX_MESSAGE_TEXT_LENGTH} characters`)
    }

    totalLength += text.length
    byId.set(messageId, {
      messageId,
      text,
      senderId: typeof message.senderId === 'string' ? message.senderId : null,
      timestamp: typeof message.timestamp === 'string' ? message.timestamp : null,
    })
  }

  if (totalLength > MAX_TOTAL_TEXT_LENGTH) {
    throw requestError(`total plaintext must not exceed ${MAX_TOTAL_TEXT_LENGTH} characters`)
  }

  const messageIds = providedMessageIds.map((messageId, index) => {
    if (typeof messageId !== 'string') throw requestError(`messageIds[${index}] must be a valid ObjectId`)
    if (!byId.has(messageId)) throw requestError('messageIds must match messages[].messageId')
    return messageId
  })

  const uniqueMessageIds = new Set(messageIds)
  if (uniqueMessageIds.size !== messageIds.length) {
    throw requestError('messageIds must be unique')
  }

  return {
    conversationId,
    messageIds,
    messageObjectIds: messageIds.map((messageId) => toObjectId(messageId, 'messageIds[]')),
    messages: messageIds.map((messageId) => byId.get(messageId)),
  }
}

function buildCacheKey({ conversationId, messageIds, messages, model }) {
  return crypto
    .createHash('sha256')
    .update(
      JSON.stringify({
        version: SUMMARY_PROMPT_VERSION,
        conversationId: conversationId.toString(),
        model,
        messageIds,
        messages: messages.map((message) => ({
          messageId: message.messageId,
          text: message.text,
          senderLabel: message.senderLabel,
        })),
      })
    )
    .digest('hex')
}

async function fetchSenderLabels(senderIds) {
  const uniqueIds = [...new Set(senderIds.filter(Boolean))]
  if (!uniqueIds.length || mongoose.connection.readyState !== 1) return new Map()
  const users = await mongoose.connection.collection('users').find({
    _id: { $in: uniqueIds.map((senderId) => toObjectId(senderId, 'senderId')) },
  }, { projection: { username: 1, displayName: 1 } }).toArray()
  return new Map(users.map((user) => [
    user._id.toString(),
    (typeof user.displayName === 'string' && user.displayName.trim()) || user.username || 'Người tham gia',
  ]))
}

async function assertConversationMembership(req, conversationId) {
  if (!req.userId) return
  const member = await mongoose.connection.collection('conversations').findOne({
    _id: conversationId,
    members: toObjectId(req.userId, 'authenticated user'),
  }, { projection: { _id: 1 } })
  if (!member) throw requestError('conversation access denied', 403)
}

async function fetchMessageMetadata({ MessageModel, conversationId, messageObjectIds }) {
  const docs = await MessageModel.find({
    _id: { $in: messageObjectIds },
    conversationId,
  })
    .select({ _id: 1, senderId: 1, timestamp: 1 })
    .lean()
    .exec()

  if (docs.length !== messageObjectIds.length) {
    throw requestError('one or more messageIds were not found in conversation', 404)
  }

  return new Map(docs.map((doc) => [doc._id.toString(), doc]))
}

export function createAiRouter({
  MessageModel = Message,
  SummaryCacheModel = AISummaryCache,
  generateText = generateGeminiText,
  moderate = moderatePlaintext,
  resolveSenderLabels = fetchSenderLabels,
  now = () => new Date(),
  model = process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL,
} = {}) {
  const router = express.Router()

  router.post('/summarize', async (req, res) => {
    try {
      const payload = normalizeSummaryPayload(req.body)
      await assertConversationMembership(req, payload.conversationId)
      const messageMetadata = await fetchMessageMetadata({
        MessageModel,
        conversationId: payload.conversationId,
        messageObjectIds: payload.messageObjectIds,
      })
      const senderIds = [...messageMetadata.values()].map((metadata) => metadata.senderId?.toString()).filter(Boolean)
      const senderLabels = await resolveSenderLabels(senderIds)
      const fallbackLabels = new Map()
      const messagesForPrompt = payload.messages.map((message) => {
        const metadata = messageMetadata.get(message.messageId)
        const senderId = metadata?.senderId?.toString() || message.senderId
        if (senderId && !fallbackLabels.has(senderId)) fallbackLabels.set(senderId, `Người tham gia ${fallbackLabels.size + 1}`)
        return {
          ...message,
          senderId,
          senderLabel: senderLabels.get(senderId) || fallbackLabels.get(senderId) || 'Người tham gia',
          timestamp: metadata?.timestamp?.toISOString?.() || message.timestamp,
        }
      })

      const cacheKey = buildCacheKey({
        conversationId: payload.conversationId,
        messageIds: payload.messageIds,
        messages: messagesForPrompt,
        model,
      })
      const currentTime = now()

      const cached = await SummaryCacheModel.findOne({
        conversationId: payload.conversationId,
        cacheKey,
        expiresAt: { $gt: currentTime },
      })
        .lean()
        .exec()

      if (cached) {
        return res.json({
          summary: cached.summary,
          cached: true,
          model: cached.model,
          expiresAt: cached.expiresAt,
          messageCount: cached.messageIds.length,
        })
      }

      const prompt = buildSummaryPrompt({
        messages: messagesForPrompt,
      })
      const summary = await generateText(prompt, { model })
      const expiresAt = new Date(currentTime.getTime() + AI_SUMMARY_CACHE_TTL_SECONDS * 1000)

      const saved = await SummaryCacheModel.findOneAndUpdate(
        { conversationId: payload.conversationId, cacheKey },
        {
          $set: {
            conversationId: payload.conversationId,
            cacheKey,
            messageIds: payload.messageObjectIds,
            summary,
            model,
            expiresAt,
          },
        },
        { upsert: true, returnDocument: 'after', runValidators: true, setDefaultsOnInsert: true }
      )
        .lean()
        .exec()

      return res.json({
        summary: saved.summary,
        cached: false,
        model: saved.model,
        expiresAt: saved.expiresAt,
        messageCount: saved.messageIds.length,
      })
    } catch (error) {
      if (error.status) return res.status(error.status).json({ error: error.message })
      if (error.code === 'AI_PROVIDER_NOT_CONFIGURED') {
        return res.status(503).json({ error: 'ai_provider_not_configured', message: 'AI summary is not configured on the server.' })
      }
      if (error.code === 'AI_PROVIDER_RATE_LIMITED') {
        return res.status(503).json({ error: 'ai_provider_rate_limited', message: 'AI summary quota is temporarily exhausted. Try again later or switch Gemini API key.' })
      }
      if (error.code === 'AI_PROVIDER_UNAVAILABLE' || error.code === 'AI_TIMEOUT') {
        return res.status(503).json({ error: 'ai_provider_unavailable', message: 'AI summary provider is temporarily busy. Please try again in a moment.' })
      }
      console.error('AI summarize error', error)
      return res.status(503).json({ error: 'ai_provider_unavailable', message: 'AI summary is temporarily unavailable.' })
    }
  })

  router.post('/moderate', async (req, res) => {
    try {
      const result = await moderate(req.body?.text)
      if (!result.allowed) {
        return res.status(422).json({
          error: 'message_blocked',
          moderation: result,
        })
      }
      return res.json({ moderation: result })
    } catch (error) {
      if (error.status === 400) return res.status(400).json({ error: error.message })
      console.error('AI moderation route error', error)
      return res.status(500).json({ error: 'internal_server_error' })
    }
  })

  return router
}

export default createAiRouter()
