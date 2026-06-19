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

const app = express()
app.use(express.json())
app.use('/auth', authRoutes)
app.use('/users', userRoutes)
app.use('/chat', chatRoutes)
app.use('/groups', groupRoutes)
app.use('/kyc', kycRoutes)

let mongo

before(async () => {
  mongo = await MongoMemoryServer.create()
  await mongoose.connect(mongo.getUri())
})

beforeEach(async () => {
  await mongoose.connection.db.dropDatabase()
})

after(async () => {
  await mongoose.disconnect()
  await mongo.stop()
})

async function register(username, email) {
  const response = await request(app).post('/auth/register').send({ username, email, password: 'correct-horse-42' })
  assert.equal(response.status, 201)
  return response.body
}

describe('integrated feature API', () => {
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

    const outsiderList = await request(app)
      .get('/groups/all')
      .set('Authorization', `Bearer ${carol.accessToken}`)
    assert.equal(outsiderList.status, 200)
    assert.equal(outsiderList.body.conversations.length, 0)
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
})
