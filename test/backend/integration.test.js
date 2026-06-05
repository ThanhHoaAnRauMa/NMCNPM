import assert from 'node:assert/strict'
import { after, before, beforeEach, test } from 'node:test'

import express from 'express'
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import request from 'supertest'

process.env.SALT_ROUNDS = '4'

let mongoServer
let User
let Conversation
let Message
let MessageSearch
let MerkleCommit
let getMessagesByCursor
let messagesRouter
let registerHealthRoutes

async function syncIndexes() {
  await Promise.all([
    User.syncIndexes(),
    Conversation.syncIndexes(),
    Message.syncIndexes(),
    MessageSearch.syncIndexes(),
    MerkleCommit.syncIndexes(),
  ])
}

async function clearCollections() {
  await Promise.all([
    User.deleteMany({}),
    Conversation.deleteMany({}),
    Message.deleteMany({}),
    MessageSearch.deleteMany({}),
    MerkleCommit.deleteMany({}),
  ])
}

async function createUser(overrides = {}) {
  const suffix = new mongoose.Types.ObjectId().toString()
  return User.create({
    username: `user-${suffix}`,
    email: `user-${suffix}@example.com`,
    password: 'strong-password',
    publicKey: `public-key-${suffix}`,
    ...overrides,
  })
}

async function createConversation(members) {
  return Conversation.create({
    members: members.map((member) => member._id),
    type: members.length > 2 ? 'group' : 'direct',
    mode: 'Standard',
    createdBy: members[0]._id,
  })
}

function createApp() {
  const app = express()
  app.use(express.json())
  registerHealthRoutes(app, { env: 'test' })
  app.use('/messages', messagesRouter)
  return app
}

before(async () => {
  ;[
    { default: User },
    { default: Conversation },
    { default: Message },
    { default: MessageSearch },
    { default: MerkleCommit },
    { getMessagesByCursor },
    { default: messagesRouter },
    { registerHealthRoutes },
  ] = await Promise.all([
    import('../../src/db/models/user.js'),
    import('../../src/db/models/conversation.js'),
    import('../../src/db/models/message.js'),
    import('../../src/db/models/messageSearch.js'),
    import('../../src/db/models/merkleCommit.js'),
    import('../../src/db/queries/messages.js'),
    import('../../src/routes/messages.js'),
    import('../../src/health.js'),
  ])

  mongoServer = await MongoMemoryServer.create()
  await mongoose.connect(mongoServer.getUri())
  await syncIndexes()
})

beforeEach(async () => {
  await clearCollections()
})

after(async () => {
  await mongoose.disconnect()
  await mongoServer.stop()
})

test('GET /health returns production health contract while /healthz remains compatible', async () => {
  const app = createApp()

  const health = await request(app).get('/health')
  assert.equal(health.status, 200)
  assert.equal(health.body.status, 'ok')
  assert.equal(typeof health.body.uptime, 'number')
  assert.match(health.body.timestamp, /^\d{4}-\d{2}-\d{2}T/)

  const healthz = await request(app).get('/healthz')
  assert.equal(healthz.status, 200)
  assert.deepEqual(healthz.body, { ok: true, env: 'test' })
})

test('User CRUD stores password hashes and supports credential comparison', async () => {
  const user = await createUser({ username: 'alice', email: 'alice@example.com' })
  assert.equal(user.username, 'alice')
  assert.notEqual(user.password, 'strong-password')

  const saved = await User.findById(user._id).select('+password')
  assert.equal(await saved.comparePassword('strong-password'), true)

  const updated = await User.findByIdAndUpdate(
    user._id,
    { kycStatus: 'verified' },
    { returnDocument: 'after' }
  )
  assert.equal(updated.kycStatus, 'verified')

  await User.findByIdAndDelete(user._id)
  assert.equal(await User.exists({ _id: user._id }), null)
})

test('Conversation CRUD persists member metadata', async () => {
  const alice = await createUser({ username: 'alice', email: 'alice@example.com' })
  const bob = await createUser({ username: 'bob', email: 'bob@example.com' })

  const conversation = await createConversation([alice, bob])
  assert.equal(conversation.members.length, 2)

  const updated = await Conversation.findByIdAndUpdate(
    conversation._id,
    { name: 'Forensics review' },
    { returnDocument: 'after' }
  )
  assert.equal(updated.name, 'Forensics review')

  const conversations = await Conversation.find({ members: alice._id })
  assert.equal(conversations.length, 1)

  await Conversation.findByIdAndDelete(conversation._id)
  assert.equal(await Conversation.exists({ _id: conversation._id }), null)
})

test('Message CRUD stores ciphertext metadata without plaintext', async () => {
  const alice = await createUser({ username: 'alice', email: 'alice@example.com' })
  const bob = await createUser({ username: 'bob', email: 'bob@example.com' })
  const conversation = await createConversation([alice, bob])

  const message = await Message.create({
    senderId: alice._id,
    conversationId: conversation._id,
    encryptedContent: 'ciphertext',
    signature: 'signature',
    timestamp: new Date('2026-06-05T00:00:00.000Z'),
  })

  assert.equal(message.encryptedContent, 'ciphertext')
  assert.match(message.contentHash, /^[a-f0-9]{64}$/)
  assert.equal(message.toObject().content, undefined)
  assert.equal(message.toObject().plaintext, undefined)

  const updated = await Message.findByIdAndUpdate(
    message._id,
    { signature: 'new-signature' },
    { returnDocument: 'after' }
  )
  assert.equal(updated.signature, 'new-signature')

  await Message.findByIdAndDelete(message._id)
  assert.equal(await Message.exists({ _id: message._id }), null)
})

test('Cursor pagination returns chat history without skip/limit offsets', async () => {
  const alice = await createUser({ username: 'alice', email: 'alice@example.com' })
  const bob = await createUser({ username: 'bob', email: 'bob@example.com' })
  const conversation = await createConversation([alice, bob])

  const timestamps = [
    new Date('2026-06-05T00:00:00.000Z'),
    new Date('2026-06-05T00:01:00.000Z'),
    new Date('2026-06-05T00:02:00.000Z'),
  ]

  await Message.create(
    timestamps.map((timestamp, index) => ({
      senderId: index % 2 === 0 ? alice._id : bob._id,
      conversationId: conversation._id,
      encryptedContent: `ciphertext-${index}`,
      signature: `signature-${index}`,
      timestamp,
    }))
  )

  const firstPage = await getMessagesByCursor({
    conversationId: conversation._id.toString(),
    limit: 2,
  })
  assert.equal(firstPage.messages.length, 2)
  assert.equal(firstPage.hasMore, true)
  assert.equal(firstPage.messages[0].encryptedContent, 'ciphertext-2')

  const secondPage = await getMessagesByCursor({
    conversationId: conversation._id.toString(),
    cursor: firstPage.nextCursor,
    limit: 2,
  })
  assert.equal(secondPage.messages.length, 1)
  assert.equal(secondPage.messages[0].encryptedContent, 'ciphertext-0')
  assert.equal(secondPage.hasMore, false)
})

test('Search API performs MongoDB text search with filters and highlights', async () => {
  const alice = await createUser({ username: 'alice', email: 'alice@example.com' })
  const bob = await createUser({ username: 'bob', email: 'bob@example.com' })
  const conversation = await createConversation([alice, bob])
  const message = await Message.create({
    senderId: alice._id,
    conversationId: conversation._id,
    encryptedContent: 'ciphertext-search',
    signature: 'signature-search',
  })

  await MessageSearch.create({
    messageId: message._id,
    conversationId: conversation._id,
    senderId: alice._id,
    snippet: 'Gemini summary for forensic chat',
    createdAt: new Date('2026-06-05T00:00:00.000Z'),
  })

  const response = await request(createApp()).post('/messages/search').send({
    keyword: 'forensic',
    conversationId: conversation._id.toString(),
    senderId: alice._id.toString(),
  })

  assert.equal(response.status, 200)
  assert.equal(response.body.results.length, 1)
  assert.match(response.body.results[0].highlightedSnippet, /<em>forensic<\/em>/i)
})

test('MerkleCommit CRUD persists on-chain commit metadata', async () => {
  const alice = await createUser({ username: 'alice', email: 'alice@example.com' })
  const bob = await createUser({ username: 'bob', email: 'bob@example.com' })
  const conversation = await createConversation([alice, bob])

  const commit = await MerkleCommit.create({
    conversationId: conversation._id,
    rootHash: 'a'.repeat(64),
    txHash: `0x${'b'.repeat(64)}`,
    leafCount: 3,
    committedBy: alice._id,
  })
  assert.equal(commit.status, 'proposed')

  const updated = await MerkleCommit.findByIdAndUpdate(
    commit._id,
    { status: 'confirmed', blockNumber: 123 },
    { returnDocument: 'after' }
  )
  assert.equal(updated.status, 'confirmed')
  assert.equal(updated.blockNumber, 123)

  const commits = await MerkleCommit.find({ conversationId: conversation._id })
  assert.equal(commits.length, 1)

  await MerkleCommit.findByIdAndDelete(commit._id)
  assert.equal(await MerkleCommit.exists({ _id: commit._id }), null)
})
