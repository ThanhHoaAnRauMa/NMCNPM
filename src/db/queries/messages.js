import mongoose from 'mongoose'
import Message from '../models/message.js'

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 100

function toObjectId(value, fieldName) {
  if (typeof value !== 'string' || !/^[a-f0-9]{24}$/i.test(value)) {
    throw new Error(`${fieldName} must be a valid ObjectId`)
  }
  return new mongoose.Types.ObjectId(value)
}

function normalizeLimit(limit) {
  const parsed = Number(limit)
  if (!Number.isInteger(parsed) || parsed < 1) return DEFAULT_LIMIT
  return Math.min(parsed, MAX_LIMIT)
}

function decodeTimestampCursor(cursor) {
  try {
    const decoded = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'))
    const timestamp = new Date(decoded.timestamp)
    if (Number.isNaN(timestamp.getTime())) throw new Error('invalid timestamp')
    return { timestamp, id: toObjectId(decoded.id, 'cursor.id') }
  } catch {
    const timestamp = new Date(cursor)
    if (Number.isNaN(timestamp.getTime())) throw new Error('cursor must be a valid timestamp cursor')
    return { timestamp, id: null }
  }
}

function encodeTimestampCursor(message) {
  return Buffer.from(
    JSON.stringify({ timestamp: message.timestamp.toISOString(), id: message._id.toString() })
  ).toString('base64url')
}

/**
 * Cursor-based message history lookup.
 * The timestamp cursor also carries _id so records with equal timestamps are not skipped.
 */
export async function getMessagesByCursor({
  conversationId,
  limit = DEFAULT_LIMIT,
  cursor = null,
  by = 'timestamp',
  before = true,
  senderId = null,
}) {
  if (!['timestamp', '_id'].includes(by)) throw new Error('by must be timestamp or _id')

  const q = { conversationId: toObjectId(conversationId, 'conversationId') }
  if (senderId) q.senderId = toObjectId(senderId, 'senderId')

  if (cursor && by === 'timestamp') {
    const { timestamp, id } = decodeTimestampCursor(cursor)
    const operator = before ? '$lt' : '$gt'
    q.$or = [{ timestamp: { [operator]: timestamp } }]
    if (id) q.$or.push({ timestamp, _id: { [operator]: id } })
  }

  if (cursor && by === '_id') {
    q._id = { [before ? '$lt' : '$gt']: toObjectId(cursor, 'cursor') }
  }

  const direction = before ? -1 : 1
  const sort = by === 'timestamp' ? { timestamp: direction, _id: direction } : { _id: direction }
  const projection = {
    encryptedContent: 1,
    senderId: 1,
    conversationId: 1,
    signature: 1,
    timestamp: 1,
    contentHash: 1,
    clientMessageId: 1,
  }
  const pageSize = normalizeLimit(limit)

  const docs = await Message.find(q)
    .select(projection)
    .sort(sort)
    .limit(pageSize + 1)
    .lean()
    .exec()

  const hasMore = docs.length > pageSize
  const messages = hasMore ? docs.slice(0, pageSize) : docs
  const lastMessage = messages.at(-1)
  const nextCursor = lastMessage
    ? by === 'timestamp'
      ? encodeTimestampCursor(lastMessage)
      : lastMessage._id.toString()
    : null

  return { messages, nextCursor, hasMore }
}
