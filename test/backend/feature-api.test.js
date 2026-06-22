import assert from 'node:assert/strict'
import { after, before, beforeEach, describe, test } from 'node:test'
import { createRequire } from 'node:module'
import express from 'express'
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import request from 'supertest'

process.env.JWT_SECRET = 'test-access-secret-with-sufficient-entropy'
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-with-sufficient-entropy'
process.env.JWT_EXPIRES_IN = '15m'
process.env.JWT_REFRESH_EXPIRES_IN = '7d'

const require = createRequire(import.meta.url)
const authRoutes = require('../../src/backend/src/routes/auth.routes.js')
const chatRoutes = require('../../src/backend/src/routes/chat.routes.js')
const groupRoutes = require('../../src/backend/src/routes/group.routes.js')
const kycRoutes = require('../../src/backend/src/routes/kyc.routes.js')
const userRoutes = require('../../src/backend/src/routes/user.routes.js')
const Message = require('../../src/backend/src/models/Message.model.js')

const app = express()
const realtimeEvents = []
app.use(express.json())
app.set('io', {
  to(room) {
    return { emit: (event, payload) => realtimeEvents.push({ room, event, payload }) }
  },
})
app.use('/auth', authRoutes)
app.use('/users', userRoutes)
app.use('/chat', chatRoutes)
app.use('/groups', groupRoutes)
app.use('/kyc', kycRoutes)

let mongo

before(async () => {
  mongo = await MongoMemoryServer.create({ instance: { launchTimeout: 60_000 } })
  await mongoose.connect(mongo.getUri())
})

beforeEach(async () => {
  await mongoose.connection.db.dropDatabase()
  realtimeEvents.length = 0
})

after(async () => {
  await mongoose.disconnect()
  if (mongo) await mongo.stop()
})

async function register(username, email) {
  const response = await request(app).post('/auth/register').send({ username, email, password: 'correct-horse-42', confirmPassword: 'correct-horse-42' })
  assert.equal(response.status, 201)
  return response.body
}

describe('integrated feature API', () => {
  test('requires matching password confirmation when registering', async () => {
    const missing = await request(app).post('/auth/register').send({
      username: 'missingConfirm',
      email: 'missing@example.com',
      password: 'correct-horse-42',
    })
    assert.equal(missing.status, 400)
    assert.equal(missing.body.code, 'MISSING_FIELDS')

    const mismatch = await request(app).post('/auth/register').send({
      username: 'mismatchConfirm',
      email: 'mismatch@example.com',
      password: 'correct-horse-42',
      confirmPassword: 'different-horse-42',
    })
    assert.equal(mismatch.status, 400)
    assert.equal(mismatch.body.code, 'PASSWORD_MISMATCH')
  })

  test('logs in with username, normalized email, and the legacy email field', async () => {
    await register('aliceLogin', 'alice.login@example.com')

    const byUsername = await request(app).post('/auth/login').send({ identifier: 'aliceLogin', password: 'correct-horse-42' })
    assert.equal(byUsername.status, 200)
    assert.equal(byUsername.body.user.username, 'aliceLogin')

    const byEmail = await request(app).post('/auth/login').send({ identifier: '  ALICE.LOGIN@EXAMPLE.COM ', password: 'correct-horse-42' })
    assert.equal(byEmail.status, 200)
    assert.equal(byEmail.body.user.email, 'alice.login@example.com')

    const legacyEmail = await request(app).post('/auth/login').send({ email: 'alice.login@example.com', password: 'correct-horse-42' })
    assert.equal(legacyEmail.status, 200)

    const wrongUsernameCase = await request(app).post('/auth/login').send({ identifier: 'alicelogin', password: 'correct-horse-42' })
    assert.equal(wrongUsernameCase.status, 401)
    assert.equal(wrongUsernameCase.body.code, 'INVALID_CREDENTIALS')
  })

  test('protects private routes and supports auth refresh', async () => {
    const unauthorized = await request(app).get('/users/me')
    assert.equal(unauthorized.status, 401)

    const registered = await register('alice', 'alice@example.com')
    const profile = await request(app).get('/users/me').set('Authorization', `Bearer ${registered.accessToken}`)
    assert.equal(profile.status, 200)
    assert.equal(profile.body.user.username, 'alice')

    const refreshed = await request(app).post('/auth/refresh').send({ refreshToken: registered.refreshToken })
    assert.equal(refreshed.status, 200)
    assert.ok(refreshed.body.accessToken)
  })

  test('creates a direct conversation and returns it only to members', async () => {
    const alice = await register('alice', 'alice@example.com')
    const bob = await register('bobby', 'bob@example.com')
    const carol = await register('carol', 'carol@example.com')

    await request(app)
      .post('/users/pubkey')
      .set('Authorization', `Bearer ${alice.accessToken}`)
      .send({ publicKey: JSON.stringify({ v: 1, encryption: {}, signing: {} }) })

    const created = await request(app)
      .post(`/users/${bob.user.id}/conversation`)
      .set('Authorization', `Bearer ${alice.accessToken}`)
      .send({ mode: 'KYC' })
    assert.equal(created.status, 201)
    const directNotification = realtimeEvents.find((entry) => entry.event === 'conversation_created')
    assert.equal(directNotification.room, `user:${bob.user.id}`)
    assert.equal(String(directNotification.payload.conversationId), String(created.body.conversationId))
    assert.equal(directNotification.payload.mode, 'KYC')

    const conversations = await request(app)
      .get('/chat/conversations')
      .set('Authorization', `Bearer ${bob.accessToken}`)
    assert.equal(conversations.status, 200)
    assert.equal(conversations.body.conversations.length, 1)
    assert.equal(String(conversations.body.conversations[0]._id), String(created.body.conversationId))

    const compatibilityList = await request(app)
      .get('/groups/all')
      .set('Authorization', `Bearer ${bob.accessToken}`)
    assert.equal(compatibilityList.status, 200)
    assert.equal(compatibilityList.body.conversations.length, 1)
    assert.equal(String(compatibilityList.body.conversations[0].conversationId), String(created.body.conversationId))

    await Message.create({
      conversationId: created.body.conversationId,
      senderId: alice.user.id,
      encryptedContent: 'ciphertext',
      signature: 'signature',
      deletedForSender: true,
    })
    const regularHistory = await request(app)
      .get(`/chat/${created.body.conversationId}/messages`)
      .set('Authorization', `Bearer ${alice.accessToken}`)
    assert.equal(regularHistory.body.messages.length, 0)
    const forensicHistory = await request(app)
      .get(`/chat/${created.body.conversationId}/messages?includeHidden=true`)
      .set('Authorization', `Bearer ${alice.accessToken}`)
    assert.equal(forensicHistory.body.messages.length, 1)

    const outsiderList = await request(app)
      .get('/groups/all')
      .set('Authorization', `Bearer ${carol.accessToken}`)
    assert.equal(outsiderList.status, 200)
    assert.equal(outsiderList.body.conversations.length, 0)

    const group = await request(app)
      .post('/groups')
      .set('Authorization', `Bearer ${alice.accessToken}`)
      .send({ name: 'Realtime group', mode: 'PRIVACY', memberIds: [bob.user.id, carol.user.id] })
    assert.equal(group.status, 201)
    const groupNotifications = realtimeEvents.filter((entry) => entry.event === 'conversation_created' && String(entry.payload.conversationId) === String(group.body.group._id))
    assert.deepEqual(new Set(groupNotifications.map((entry) => entry.room)), new Set([`user:${bob.user.id}`, `user:${carol.user.id}`]))
  })

  test('keeps separate KYC and Privacy direct conversations for the same users', async () => {
    const alice = await register('alice', 'alice@example.com')
    const bob = await register('bobby', 'bob@example.com')

    const kyc = await request(app)
      .post(`/users/${bob.user.id}/conversation`)
      .set('Authorization', `Bearer ${alice.accessToken}`)
      .send({ mode: 'KYC' })
    assert.equal(kyc.status, 201)
    assert.equal(kyc.body.conversation.mode, 'KYC')

    const existingKyc = await request(app)
      .post(`/users/${alice.user.id}/conversation`)
      .set('Authorization', `Bearer ${bob.accessToken}`)
      .send({ mode: 'KYC' })
    assert.equal(existingKyc.status, 200)
    assert.equal(existingKyc.body.isNew, false)
    assert.equal(String(existingKyc.body.conversationId), String(kyc.body.conversationId))

    const privacy = await request(app)
      .post(`/users/${bob.user.id}/conversation`)
      .set('Authorization', `Bearer ${alice.accessToken}`)
      .send({ mode: 'PRIVACY' })
    assert.equal(privacy.status, 201)
    assert.equal(privacy.body.conversation.mode, 'PRIVACY')
    assert.notEqual(String(privacy.body.conversationId), String(kyc.body.conversationId))

    const existingPrivacy = await request(app)
      .post(`/users/${alice.user.id}/conversation`)
      .set('Authorization', `Bearer ${bob.accessToken}`)
      .send({ mode: 'PRIVACY' })
    assert.equal(existingPrivacy.status, 200)
    assert.equal(existingPrivacy.body.isNew, false)
    assert.equal(String(existingPrivacy.body.conversationId), String(privacy.body.conversationId))

    const conversations = await request(app)
      .get('/chat/conversations')
      .set('Authorization', `Bearer ${alice.accessToken}`)
    assert.equal(conversations.status, 200)
    assert.equal(conversations.body.conversations.length, 2)
    assert.deepEqual(new Set(conversations.body.conversations.map((item) => item.mode)), new Set(['KYC', 'PRIVACY']))
  })

  test('places client-signed KYC proof in pending state', async () => {
    const alice = await register('alice', 'alice@example.com')
    const submitted = await request(app)
      .post('/kyc/submit')
      .set('Authorization', `Bearer ${alice.accessToken}`)
      .send({ hash: 'a'.repeat(64), signature: 'signed-hash', pubkey: 'public-key' })

    assert.equal(submitted.status, 201)
    assert.equal(submitted.body.kycRecord.status, 'PENDING')

    const status = await request(app).get('/kyc/status').set('Authorization', `Bearer ${alice.accessToken}`)
    assert.equal(status.body.kycStatus, 'PENDING')
  })

  test('restricts KYC reviews and synchronizes reviewer decisions', async () => {
    const alice = await register('alice', 'alice@example.com')
    const reviewer = await register('reviewer', 'reviewer@example.com')
    const submitted = await request(app)
      .post('/kyc/submit')
      .set('Authorization', `Bearer ${alice.accessToken}`)
      .send({ hash: 'b'.repeat(64), signature: 'signed-hash', pubkey: 'public-key' })

    const denied = await request(app)
      .get('/kyc/reviews')
      .set('Authorization', `Bearer ${alice.accessToken}`)
    assert.equal(denied.status, 403)

    process.env.KYC_REVIEWER_USER_IDS = reviewer.user.id
    const queue = await request(app)
      .get('/kyc/reviews')
      .set('Authorization', `Bearer ${reviewer.accessToken}`)
    assert.equal(queue.status, 200)
    assert.equal(queue.body.records.length, 1)

    const reviewed = await request(app)
      .patch(`/kyc/reviews/${submitted.body.kycRecord.id}`)
      .set('Authorization', `Bearer ${reviewer.accessToken}`)
      .send({ status: 'REJECTED', rejectionReason: 'The submitted proof cannot be validated.' })
    assert.equal(reviewed.status, 200)
    assert.equal(reviewed.body.kycRecord.status, 'REJECTED')

    const status = await request(app).get('/kyc/status').set('Authorization', `Bearer ${alice.accessToken}`)
    assert.equal(status.body.kycStatus, 'REJECTED')

    const resubmitted = await request(app)
      .post('/kyc/submit')
      .set('Authorization', `Bearer ${alice.accessToken}`)
      .send({ hash: 'c'.repeat(64), signature: 'new-signature', pubkey: 'public-key' })
    assert.equal(resubmitted.status, 201)
    assert.equal(resubmitted.body.kycRecord.status, 'PENDING')
    delete process.env.KYC_REVIEWER_USER_IDS
  })
})
