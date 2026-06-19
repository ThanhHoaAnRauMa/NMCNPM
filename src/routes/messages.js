import express from 'express'
import mongoose from 'mongoose'
import MessageSearch from '../db/models/messageSearch.js'

const router = express.Router()
const MAX_KEYWORD_LENGTH = 200
const MAX_SEARCH_RESULTS = 100
const MAX_SNIPPET_LENGTH = 2000

function toObjectId(value, fieldName) {
  if (typeof value !== 'string' || !/^[a-f0-9]{24}$/i.test(value)) {
    const error = new Error(`${fieldName} must be a valid ObjectId`)
    error.status = 400
    throw error
  }
  return new mongoose.Types.ObjectId(value)
}

function toDate(value, fieldName) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    const error = new Error(`${fieldName} must be a valid date`)
    error.status = 400
    throw error
  }
  return date
}

function normalizeLimit(value) {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 1) return 20
  return Math.min(parsed, MAX_SEARCH_RESULTS)
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (character) => {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]
  })
}

function highlight(text, keyword) {
  const safeText = escapeHtml(text)
  const tokens = keyword
    .split(/\s+/)
    .map((token) => token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .filter(Boolean)

  if (!tokens.length) return safeText
  return safeText.replace(new RegExp(`(${tokens.join('|')})`, 'gi'), '<em>$1</em>')
}

async function authorizedConversationIds(req, requestedConversationId) {
  if (!req.userId) return requestedConversationId ? [requestedConversationId] : null
  const userId = toObjectId(req.userId, 'authenticated user')
  const filter = { members: userId }
  if (requestedConversationId) filter._id = requestedConversationId
  const conversations = await mongoose.connection.collection('conversations')
    .find(filter)
    .project({ _id: 1 })
    .toArray()
  return conversations.map((conversation) => conversation._id)
}

/*
 * Search uses opt-in ephemeral snippets because MongoDB cannot text-search E2E ciphertext.
 * The main Message collection remains ciphertext-only.
 */
router.post('/search', async (req, res) => {
  const { keyword, dateFrom, dateTo, senderId, conversationId, limit = 20 } = req.body

  if (typeof keyword !== 'string' || !keyword.trim()) {
    return res.status(400).json({ error: 'keyword is required' })
  }

  if (keyword.length > MAX_KEYWORD_LENGTH) {
    return res.status(400).json({ error: `keyword must not exceed ${MAX_KEYWORD_LENGTH} characters` })
  }

  try {
    const match = { $text: { $search: keyword.trim() } }

    const requestedConversationId = conversationId ? toObjectId(conversationId, 'conversationId') : null
    const allowedConversationIds = await authorizedConversationIds(req, requestedConversationId)
    if (allowedConversationIds && !allowedConversationIds.length) return res.json({ results: [] })
    if (allowedConversationIds) match.conversationId = { $in: allowedConversationIds }
    else if (requestedConversationId) match.conversationId = requestedConversationId
    if (senderId) match.senderId = toObjectId(senderId, 'senderId')
    if (dateFrom || dateTo) {
      match.createdAt = {}
      if (dateFrom) match.createdAt.$gte = toDate(dateFrom, 'dateFrom')
      if (dateTo) match.createdAt.$lte = toDate(dateTo, 'dateTo')
      if (match.createdAt.$gte && match.createdAt.$lte && match.createdAt.$gte > match.createdAt.$lte) {
        return res.status(400).json({ error: 'dateFrom must be before dateTo' })
      }
    }

    const results = await MessageSearch.aggregate([
      { $match: match },
      { $addFields: { score: { $meta: 'textScore' } } },
      { $sort: { score: -1, createdAt: -1 } },
      { $limit: normalizeLimit(limit) },
      {
        $project: {
          messageId: 1,
          conversationId: 1,
          senderId: 1,
          snippet: 1,
          score: 1,
          createdAt: 1,
        },
      },
    ]).exec()

    return res.json({
      results: results.map((result) => ({
        ...result,
        highlightedSnippet: highlight(result.snippet, keyword.trim()),
      })),
    })
  } catch (error) {
    if (error.status === 400) return res.status(400).json({ error: error.message })
    console.error('Search error', error)
    return res.status(500).json({ error: 'internal_server_error' })
  }
})

/*
 * Clients must explicitly opt in and send only a small decrypted snippet.
 * Authentication and conversation authorization are integrated by the Backend owner.
 */
router.post('/index-snippet', async (req, res) => {
  const { messageId, conversationId, senderId, snippet } = req.body

  if (!messageId || !conversationId || !senderId || typeof snippet !== 'string' || !snippet.trim()) {
    return res.status(400).json({ error: 'messageId, conversationId, senderId and snippet are required' })
  }

  if (snippet.length > MAX_SNIPPET_LENGTH) {
    return res.status(400).json({ error: `snippet must not exceed ${MAX_SNIPPET_LENGTH} characters` })
  }

  try {
    const messageObjectId = toObjectId(messageId, 'messageId')
    const conversationObjectId = toObjectId(conversationId, 'conversationId')
    const senderObjectId = toObjectId(senderId, 'senderId')
    if (req.userId) {
      if (String(req.userId) !== String(senderId)) return res.status(403).json({ error: 'senderId must match authenticated user' })
      const allowed = await authorizedConversationIds(req, conversationObjectId)
      if (!allowed.length) return res.status(403).json({ error: 'conversation access denied' })
      const message = await mongoose.connection.collection('messages').findOne({
        _id: messageObjectId,
        conversationId: conversationObjectId,
        senderId: senderObjectId,
      }, { projection: { _id: 1 } })
      if (!message) return res.status(404).json({ error: 'message not found in conversation' })
    }
    const document = await MessageSearch.findOneAndUpdate(
      { messageId: messageObjectId },
      {
        $set: {
          conversationId: conversationObjectId,
          senderId: senderObjectId,
          snippet: snippet.trim(),
          createdAt: new Date(),
        },
      },
      { upsert: true, returnDocument: 'after', runValidators: true, setDefaultsOnInsert: true }
    )

    return res.status(201).json({ id: document._id })
  } catch (error) {
    if (error.status === 400) return res.status(400).json({ error: error.message })
    console.error('index-snippet error', error)
    return res.status(500).json({ error: 'internal_server_error' })
  }
})

export default router
