import mongoose from 'mongoose'
import Message from '../models/message.js'

/**
 * Cursor-based pagination for messages in a conversation.
 * Uses the compound index { conversationId: 1, timestamp: -1 } for fast queries.
 *
 * Params:
 * - conversationId: string/ObjectId (required)
 * - limit: number (default 50)
 * - cursor: ISO timestamp string or ObjectId string (optional)
 * - by: 'timestamp' | '_id' (default 'timestamp')
 * - before: boolean true => get older messages (default true)
 * - senderId: optional filter by sender
 *
 * Returns { messages, nextCursor, hasMore }
 */
export async function getMessagesByCursor({
  conversationId,
  limit = 50,
  cursor = null,
  by = 'timestamp',
  before = true,
  senderId = null,
}) {
  if (!conversationId) throw new Error('conversationId is required')

  const q = { conversationId: mongoose.Types.ObjectId(conversationId) }
  if (senderId) q.senderId = mongoose.Types.ObjectId(senderId)

  if (cursor) {
    if (by === 'timestamp') {
      const date = new Date(cursor)
      q.timestamp = before ? { $lt: date } : { $gt: date }
    } else {
      q._id = before ? { $lt: mongoose.Types.ObjectId(cursor) } : { $gt: mongoose.Types.ObjectId(cursor) }
    }
  }

  const sort = by === 'timestamp' ? { timestamp: before ? -1 : 1 } : { _id: before ? -1 : 1 }

  // Project only necessary fields to keep query fast
  const projection = { encryptedContent: 1, senderId: 1, conversationId: 1, signature: 1, timestamp: 1 }

  const docs = await Message.find(q)
    .select(projection)
    .sort(sort)
    .limit(limit + 1)
    .lean()
    .exec()

  const hasMore = docs.length > limit
  const results = hasMore ? docs.slice(0, limit) : docs

  const nextCursor = results.length
    ? by === 'timestamp'
      ? results[results.length - 1].timestamp.toISOString()
      : results[results.length - 1]._id.toString()
    : null

  return { messages: results, nextCursor, hasMore }
}
