import assert from 'node:assert/strict'
import { after, before, beforeEach, describe, test } from 'node:test'
import { createRequire } from 'node:module'
import crypto from 'node:crypto'
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
const Conversation = require('../../src/backend/src/models/Conversation.model.js')
const Message = require('../../src/backend/src/models/Message.model.js')
const User = require('../../src/backend/src/models/User.model.js')
const KYCRecord = require('../../src/backend/src/models/KYCRecord.model.js')
const cloudinaryUtils = require('../../src/backend/src/utils/cloudinary.utils.js')
const signatureUtils = require('../../src/backend/src/utils/signature.utils.js')
const bcrypt = require('bcryptjs')

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
let uploadSequence = 0
const deletedCloudinaryAssets = []

before(async () => {
  mongo = await MongoMemoryServer.create({ instance: { launchTimeout: 60_000 } })
  await mongoose.connect(mongo.getUri())
})

beforeEach(async () => {
  await mongoose.connection.db.dropDatabase()
  realtimeEvents.length = 0
  uploadSequence = 0
  deletedCloudinaryAssets.length = 0
  cloudinaryUtils.uploadToCloudinary = async () => ({ publicId: `kyc-test-${++uploadSequence}`, format: 'png', url: 'private' })
  cloudinaryUtils.deleteFromCloudinary = async (publicId, resourceType, type) => deletedCloudinaryAssets.push({ publicId, resourceType, type })
  cloudinaryUtils.signedAuthenticatedImageUrl = (publicId) => `https://signed.example/${publicId}`
  signatureUtils.verifyEnvelopeSignature = async () => true
})

after(async () => {
  await mongoose.disconnect()
  if (mongo) await mongo.stop()
})

async function register(username, email) {
  const response = await request(app).post('/auth/register').send({ username, email, password: 'correct-horse-42', confirmPassword: 'correct-horse-42' })
  assert.equal(response.status, 201, `register ${username}/${email} failed: ${JSON.stringify(response.body)}`)
  return response.body
}

async function submitKyc(account, overrides = {}) {
  const pngHeader = Buffer.from('89504e470d0a1a0a', 'hex')
  const front = Buffer.concat([pngHeader, Buffer.from(overrides.front || 'front-image')])
  const back = Buffer.concat([pngHeader, Buffer.from(overrides.back || 'back-image')])
  const details = {
    fullName: overrides.fullName || 'Nguyen Van Alice', citizenId: overrides.citizenId || '012345678901',
    dateOfBirth: overrides.dateOfBirth || '2000-01-02', address: overrides.address || '123 Test Street',
  }
  const payload = JSON.stringify({ ...details, frontHash: crypto.createHash('sha256').update(front).digest('hex'), backHash: crypto.createHash('sha256').update(back).digest('hex') })
  const hash = overrides.hash || crypto.createHash('sha256').update(payload).digest('hex')
  await User.findByIdAndUpdate(account.user.id, { publicKey: 'public-key' })
  return request(app).post('/kyc/submit').set('Authorization', `Bearer ${account.accessToken}`)
    .field({ ...details, hash, signature: 'signed-hash', pubkey: 'public-key' })
    .attach('documentFront', front, { filename: 'front.png', contentType: 'image/png' })
    .attach('documentBack', back, { filename: 'back.png', contentType: 'image/png' })
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

    const normalizedUsername = await request(app).post('/auth/login').send({ identifier: 'alicelogin', password: 'correct-horse-42' })
    assert.equal(normalizedUsername.status, 200)
    assert.equal(normalizedUsername.body.user.username, 'aliceLogin')

    const duplicateUsername = await request(app).post('/auth/register').send({
      username: 'ALICELOGIN', email: 'another@example.com', password: 'correct-horse-42', confirmPassword: 'correct-horse-42',
    })
    assert.equal(duplicateUsername.status, 409)
    assert.equal(duplicateUsername.body.code, 'USERNAME_ALREADY_EXISTS')

    await User.collection.insertOne({ username: 'ALIceLogin', email: 'legacy-case@example.com', password: await bcrypt.hash('different-horse-42', 12) })
    const legacyCollision = await request(app).post('/auth/login').send({ identifier: 'alicelogin', password: 'different-horse-42' })
    assert.equal(legacyCollision.status, 200)
    assert.equal(legacyCollision.body.user.username, 'ALIceLogin')

    await User.create({ username: 'alice.login@example.com', email: 'username-owner@example.com', password: await bcrypt.hash('username-password-42', 12) })
    const emailShapedUsername = await request(app).post('/auth/login').send({ identifier: 'alice.login@example.com', password: 'username-password-42' })
    assert.equal(emailShapedUsername.status, 200)
    assert.equal(emailShapedUsername.body.user.username, 'alice.login@example.com')

    const ambiguousEmailOwner = await request(app).post('/auth/login').send({ identifier: 'alice.login@example.com', password: 'correct-horse-42' })
    assert.equal(ambiguousEmailOwner.status, 200)
    assert.equal(ambiguousEmailOwner.body.user.username, 'aliceLogin')

    const prefixedUsername = await request(app).post('/auth/login').send({ identifier: '@aliceLogin', password: 'correct-horse-42' })
    assert.equal(prefixedUsername.status, 200)
    assert.equal(prefixedUsername.body.user.username, 'aliceLogin')
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
    await User.updateMany({ _id: { $in: [alice.user.id, bob.user.id] } }, { kycStatus: 'VERIFIED' })

    await request(app)
      .post('/users/pubkey')
      .set('Authorization', `Bearer ${alice.accessToken}`)
      .send({ publicKey: JSON.stringify({ v: 1, encryption: {}, signing: {} }) })

    const created = await request(app)
      .post(`/users/${bob.user.id}/conversation`)
      .set('Authorization', `Bearer ${alice.accessToken}`)
      .send({ mode: 'KYC' })
    assert.equal(created.status, 201)
    assert.match(created.body.roomId, /^0x[a-f0-9]{64}$/i)
    const directNotification = realtimeEvents.find((entry) => entry.event === 'conversation_created')
    assert.equal(directNotification.room, `user:${bob.user.id}`)
    assert.equal(String(directNotification.payload.conversationId), String(created.body.conversationId))
    assert.equal(directNotification.payload.roomId, created.body.roomId)
    assert.equal(directNotification.payload.mode, 'KYC')

    const conversations = await request(app)
      .get('/chat/conversations')
      .set('Authorization', `Bearer ${bob.accessToken}`)
    assert.equal(conversations.status, 200)
    assert.equal(conversations.body.conversations.length, 1)
    assert.equal(String(conversations.body.conversations[0]._id), String(created.body.conversationId))
    assert.equal(conversations.body.conversations[0].roomId, created.body.roomId)

    const compatibilityList = await request(app)
      .get('/groups/all')
      .set('Authorization', `Bearer ${bob.accessToken}`)
    assert.equal(compatibilityList.status, 200)
    assert.equal(compatibilityList.body.conversations.length, 1)
    assert.equal(String(compatibilityList.body.conversations[0].conversationId), String(created.body.conversationId))
    assert.equal(compatibilityList.body.conversations[0].roomId, created.body.roomId)

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

    const archived = await request(app)
      .patch(`/chat/conversations/${created.body.conversationId}/archive`)
      .set('Authorization', `Bearer ${bob.accessToken}`)
      .send({ archived: true })
    assert.equal(archived.status, 200)
    assert.equal(archived.body.archived, true)
    const hiddenFromDefault = await request(app).get('/chat/conversations').set('Authorization', `Bearer ${bob.accessToken}`)
    assert.equal(hiddenFromDefault.body.conversations.length, 0)
    const archivedList = await request(app).get('/chat/conversations?includeArchived=true').set('Authorization', `Bearer ${bob.accessToken}`)
    assert.equal(archivedList.body.conversations.length, 1)
    assert.equal(archivedList.body.conversations[0].archived, true)

    const unarchived = await request(app)
      .patch(`/chat/conversations/${created.body.conversationId}/archive`)
      .set('Authorization', `Bearer ${bob.accessToken}`)
      .send({ archived: false })
    assert.equal(unarchived.status, 200)
    assert.equal(unarchived.body.archived, false)
    const restoredList = await request(app).get('/chat/conversations').set('Authorization', `Bearer ${bob.accessToken}`)
    assert.equal(restoredList.body.conversations.length, 1)

    const deleted = await request(app)
      .delete(`/chat/conversations/${created.body.conversationId}`)
      .set('Authorization', `Bearer ${bob.accessToken}`)
    assert.equal(deleted.status, 200)
    const deletedForBob = await request(app).get('/chat/conversations?includeArchived=true').set('Authorization', `Bearer ${bob.accessToken}`)
    assert.equal(deletedForBob.body.conversations.length, 0)
    assert.ok(await Conversation.exists({ _id: created.body.conversationId }))

    const group = await request(app)
      .post('/groups')
      .set('Authorization', `Bearer ${alice.accessToken}`)
      .send({ name: 'Realtime group', mode: 'PRIVACY', memberIds: [bob.user.id, carol.user.id] })
    assert.equal(group.status, 201)
    const groupNotifications = realtimeEvents.filter((entry) => entry.event === 'conversation_created' && String(entry.payload.conversationId) === String(group.body.group._id))
    assert.deepEqual(new Set(groupNotifications.map((entry) => entry.room)), new Set([`user:${bob.user.id}`, `user:${carol.user.id}`]))

    const kycGroup = await request(app).post('/groups').set('Authorization', `Bearer ${alice.accessToken}`)
      .send({ name: 'Verified group', mode: 'KYC', memberIds: [bob.user.id] })
    assert.equal(kycGroup.status, 201)
    const blockedMember = await request(app).post(`/groups/${kycGroup.body.group._id}/members`)
      .set('Authorization', `Bearer ${alice.accessToken}`).send({ userId: carol.user.id })
    assert.equal(blockedMember.status, 403)
    assert.equal(blockedMember.body.code, 'KYC_REQUIRED')
  })

  test('keeps separate KYC and Privacy direct conversations for the same users', async () => {
    const alice = await register('alice', 'alice@example.com')
    const bob = await register('bobby', 'bob@example.com')

    const blockedKyc = await request(app).post(`/users/${bob.user.id}/conversation`).set('Authorization', `Bearer ${alice.accessToken}`).send({ mode: 'KYC' })
    assert.equal(blockedKyc.status, 403)
    assert.equal(blockedKyc.body.code, 'KYC_REQUIRED')
    await User.updateMany({ _id: { $in: [alice.user.id, bob.user.id] } }, { kycStatus: 'VERIFIED' })

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
    const tampered = await submitKyc(alice, { hash: 'a'.repeat(64) })
    assert.equal(tampered.status, 409)
    assert.equal(tampered.body.code, 'INVALID_KYC_PROOF')
    assert.equal(uploadSequence, 0)
    const submitted = await submitKyc(alice)

    assert.equal(submitted.status, 201)
    assert.equal(submitted.body.kycRecord.status, 'PENDING')

    const status = await request(app).get('/kyc/status').set('Authorization', `Bearer ${alice.accessToken}`)
    assert.equal(status.body.kycStatus, 'PENDING')

    const updated = await submitKyc(alice, { address: '456 Updated Street', front: 'updated-front', back: 'updated-back' })
    assert.equal(updated.status, 201)
    assert.equal(updated.body.updated, true)
    assert.equal(updated.body.kycRecord.status, 'PENDING')
    const currentRecord = await KYCRecord.findById(updated.body.kycRecord.id).lean()
    assert.equal(currentRecord.address, '456 Updated Street')
    assert.deepEqual(deletedCloudinaryAssets, [
      { publicId: 'kyc-test-1', resourceType: 'image', type: 'authenticated' },
      { publicId: 'kyc-test-2', resourceType: 'image', type: 'authenticated' },
    ])

    const mine = await request(app).get('/kyc/me').set('Authorization', `Bearer ${alice.accessToken}`)
    assert.equal(mine.status, 200)
    assert.equal(mine.body.kycRecord.address, '456 Updated Street')
    assert.equal(mine.body.kycRecord.hasDocumentFront, true)
  })

  test('restricts KYC reviews and synchronizes reviewer decisions', async () => {
    const alice = await register('alice', 'alice@example.com')
    const reviewer = await register('reviewer', 'reviewer@example.com')
    const submitted = await submitKyc(alice)

    const denied = await request(app)
      .get('/kyc/reviews')
      .set('Authorization', `Bearer ${alice.accessToken}`)
    assert.equal(denied.status, 403)

    process.env.KYC_REVIEWER_EMAILS = reviewer.user.email
    const queue = await request(app)
      .get('/kyc/reviews')
      .set('Authorization', `Bearer ${reviewer.accessToken}`)
    assert.equal(queue.status, 200)
    assert.equal(queue.body.records.length, 1)
    assert.match(queue.body.records[0].documents.frontUrl, /^https:\/\/signed\.example\//)

    const reviewed = await request(app)
      .patch(`/kyc/reviews/${submitted.body.kycRecord.id}`)
      .set('Authorization', `Bearer ${reviewer.accessToken}`)
      .send({ status: 'REJECTED', rejectionReason: 'The submitted proof cannot be validated.' })
    assert.equal(reviewed.status, 200)
    assert.equal(reviewed.body.kycRecord.status, 'REJECTED')
    assert.deepEqual(deletedCloudinaryAssets, [
      { publicId: 'kyc-test-1', resourceType: 'image', type: 'authenticated' },
      { publicId: 'kyc-test-2', resourceType: 'image', type: 'authenticated' },
    ])
    const rejectedRecord = await KYCRecord.findById(submitted.body.kycRecord.id).lean()
    assert.equal(rejectedRecord.documentFrontPublicId, null)
    assert.equal(rejectedRecord.documentBackPublicId, null)

    const status = await request(app).get('/kyc/status').set('Authorization', `Bearer ${alice.accessToken}`)
    assert.equal(status.body.kycStatus, 'REJECTED')

    const resubmitted = await submitKyc(alice, { front: 'new-front', back: 'new-back' })
    assert.equal(resubmitted.status, 201)
    assert.equal(resubmitted.body.kycRecord.status, 'PENDING')
    delete process.env.KYC_REVIEWER_EMAILS
  })
})
