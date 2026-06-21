import assert from 'node:assert/strict'
import test from 'node:test'
import { isDeepStrictEqual } from 'node:util'
import mongoose from 'mongoose'

import Conversation from '../../src/db/models/conversation.js'
import AISummaryCache from '../../src/db/models/aiSummaryCache.js'
import KYCRecord from '../../src/db/models/kycRecord.js'
import MerkleCommit from '../../src/db/models/merkleCommit.js'
import Message from '../../src/db/models/message.js'
import MessageSearch from '../../src/db/models/messageSearch.js'
import User from '../../src/db/models/user.js'

function hasIndex(model, expectedKeys) {
  return model.schema.indexes().some(([keys]) => isDeepStrictEqual(keys, expectedKeys))
}

test('Message stores ciphertext metadata only and has Week 2 history indexes', () => {
  const paths = Object.keys(Message.schema.paths)
  assert.ok(paths.includes('encryptedContent'))
  assert.ok(paths.includes('signature'))
  assert.ok(paths.includes('contentHash'))
  assert.ok(!paths.includes('content'))
  assert.ok(!paths.includes('plaintext'))

  assert.ok(hasIndex(Message, { conversationId: 1, timestamp: -1, _id: -1 }))
  assert.ok(hasIndex(Message, { senderId: 1, timestamp: -1, _id: -1 }))
})

test('MessageSearch is text indexed and TTL-cleaned after 24 hours', () => {
  const indexes = MessageSearch.schema.indexes()
  assert.ok(hasIndex(MessageSearch, { snippet: 'text' }))
  assert.ok(
    indexes.some(
      ([keys, options]) => keys.createdAt === 1 && options.expireAfterSeconds === 60 * 60 * 24
    )
  )
})

test('AISummaryCache stores summaries only and expires after one hour', () => {
  const paths = Object.keys(AISummaryCache.schema.paths)
  assert.ok(paths.includes('summary'))
  assert.ok(paths.includes('cacheKey'))
  assert.ok(paths.includes('expiresAt'))
  assert.ok(!paths.includes('plaintext'))
  assert.ok(!paths.includes('messages'))

  const indexes = AISummaryCache.schema.indexes()
  assert.ok(hasIndex(AISummaryCache, { conversationId: 1, cacheKey: 1 }))
  assert.ok(indexes.some(([keys, options]) => keys.expiresAt === 1 && options.expireAfterSeconds === 0))
})

test('Conversation rejects empty or duplicate member lists', async () => {
  await assert.rejects(new Conversation({ members: [] }).validate(), /members/)

  const memberId = new mongoose.Types.ObjectId()
  await assert.rejects(new Conversation({ members: [memberId, memberId] }).validate(), /members/)
})

test('MerkleCommit and KYCRecord reject non-SHA-256 hashes', async () => {
  const conversationId = new mongoose.Types.ObjectId()
  const userId = new mongoose.Types.ObjectId()

  await assert.rejects(
    new MerkleCommit({ conversationId, rootHash: 'invalid' }).validate(),
    /rootHash/
  )
  await assert.rejects(new KYCRecord({ userId, docHash: 'invalid', signature: 'sig', pubkey: 'key' }).validate(), /docHash/)
})

test('User validates identity fields and keeps password hidden by default', async () => {
  const passwordPath = User.schema.path('password')
  assert.equal(passwordPath.options.select, false)

  await assert.rejects(
    new User({ username: 'tu', email: 'invalid', password: 'short' }).validate(),
    /username/
  )
})
