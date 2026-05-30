import express from 'express'
import mongoose from 'mongoose'
import MessageSearch from '../db/models/messageSearch.js'

const router = express.Router()

/*
 POST /messages/search
 Body: { keyword, dateFrom, dateTo, senderId, conversationId, limit }

 Notes on encrypted chat full-text search:
 - The main `Message` documents only store `encryptedContent` (ciphertext).
 - Clients that wish to enable server-side search should decrypt locally and send
   a small, ephemeral `snippet` to the `MessageSearch` collection via a dedicated
   indexing endpoint. `MessageSearch` is TTL-ed and text-indexed; it should NOT
   be used to persist full plaintext messages.
 - The search endpoint below queries the ephemeral `MessageSearch` index and returns
   results sorted by `$meta: 'textScore'` and a simple highlighted snippet.
*/

router.post('/search', async (req, res) => {
  const { keyword, dateFrom, dateTo, senderId, conversationId, limit = 20 } = req.body

  if (!keyword) return res.status(400).json({ error: 'keyword is required' })

  try {
    const match = { $text: { $search: keyword } }

    if (conversationId) match.conversationId = mongoose.Types.ObjectId(conversationId)
    if (senderId) match.senderId = mongoose.Types.ObjectId(senderId)
    if (dateFrom || dateTo) {
      match.createdAt = {}
      if (dateFrom) match.createdAt.$gte = new Date(dateFrom)
      if (dateTo) match.createdAt.$lte = new Date(dateTo)
    }

    const pipeline = [
      { $match: match },
      { $addFields: { score: { $meta: 'textScore' } } },
      { $sort: { score: -1, createdAt: -1 } },
      { $limit: Number(limit) },
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
    ]

    const results = await MessageSearch.aggregate(pipeline).exec()

    // Simple snippet highlight (safe client-side highlighting recommended)
    const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const highlight = (text, kw) => {
      if (!text) return ''
      const tokens = kw.split(/\s+/).map(escapeRegex).filter(Boolean)
      if (!tokens.length) return text
      const rx = new RegExp(`(${tokens.join('|')})`, 'gi')
      return text.replace(rx, '<em>$1</em>')
    }

    const out = results.map((r) => ({
      ...r,
      highlightedSnippet: highlight(r.snippet, keyword),
    }))

    return res.json({ results: out })
  } catch (err) {
    console.error('Search error', err)
    return res.status(500).json({ error: 'internal_server_error' })
  }
})

/*
  POST /messages/index-snippet
  Body: { messageId, conversationId, senderId, snippet }
  Endpoint for clients to push ephemeral decrypted snippet for indexing.
  WARNING: Clients must NOT send full plaintext history. Keep snippet short.
*/
router.post('/index-snippet', async (req, res) => {
  const { messageId, conversationId, senderId, snippet } = req.body
  if (!messageId || !conversationId || !senderId || !snippet)
    return res.status(400).json({ error: 'missing fields' })

  // Basic size guard
  if (typeof snippet !== 'string' || snippet.length > 2000) {
    return res.status(400).json({ error: 'snippet too long or invalid' })
  }

  try {
    const doc = await MessageSearch.create({
      messageId: mongoose.Types.ObjectId(messageId),
      conversationId: mongoose.Types.ObjectId(conversationId),
      senderId: mongoose.Types.ObjectId(senderId),
      snippet,
    })
    return res.status(201).json({ id: doc._id })
  } catch (err) {
    console.error('index-snippet error', err)
    return res.status(500).json({ error: 'internal_server_error' })
  }
})

export default router
