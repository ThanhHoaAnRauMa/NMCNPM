import assert from 'node:assert/strict'
import test from 'node:test'
import express from 'express'
import mongoose from 'mongoose'
import request from 'supertest'

import { createAiRouter } from '../../src/routes/ai.js'
import {
  createContentModerationMiddleware,
  DEFAULT_MODERATION_TIMEOUT_MS,
  MAX_MODERATION_TIMEOUT_MS,
  moderatePlaintext,
} from '../../src/services/aiModeration.js'

function createQuery(result) {
  return {
    select() {
      return this
    },
    lean() {
      return this
    },
    async exec() {
      return result
    },
  }
}

function createApp(router) {
  const app = express()
  app.use(express.json())
  app.use('/ai', router)
  return app
}

test('POST /ai/summarize requires opt-in plaintext messages', async () => {
  const router = createAiRouter()
  const response = await request(createApp(router)).post('/ai/summarize').send({
    conversationId: new mongoose.Types.ObjectId().toString(),
    messageIds: [new mongoose.Types.ObjectId().toString()],
  })

  assert.equal(response.status, 400)
  assert.match(response.body.error, /plaintext/)
})

test('POST /ai/summarize verifies message ids and stores summary without plaintext', async () => {
  const conversationId = new mongoose.Types.ObjectId()
  const messageId = new mongoose.Types.ObjectId()
  const now = new Date('2026-06-04T00:00:00.000Z')
  let messageQuery
  let cacheUpdate
  let generateCalls = 0

  const MessageModel = {
    find(query) {
      messageQuery = query
      return createQuery([{ _id: messageId }])
    },
  }

  const SummaryCacheModel = {
    findOne() {
      return createQuery(null)
    },
    findOneAndUpdate(_filter, update) {
      cacheUpdate = update
      return createQuery(update.$set)
    },
  }

  const router = createAiRouter({
    MessageModel,
    SummaryCacheModel,
    now: () => now,
    model: 'gemini-test',
    async generateText(prompt) {
      generateCalls += 1
      assert.match(prompt, /hello secure chat/)
      return 'Short summary'
    },
  })

  const response = await request(createApp(router)).post('/ai/summarize').send({
    conversationId: conversationId.toString(),
    messageIds: [messageId.toString()],
    messages: [
      {
        messageId: messageId.toString(),
        senderId: new mongoose.Types.ObjectId().toString(),
        timestamp: now.toISOString(),
        text: 'hello secure chat',
      },
    ],
  })

  assert.equal(response.status, 200)
  assert.equal(response.body.summary, 'Short summary')
  assert.equal(response.body.cached, false)
  assert.equal(generateCalls, 1)
  assert.equal(messageQuery.conversationId.toString(), conversationId.toString())
  assert.equal(cacheUpdate.$set.summary, 'Short summary')
  assert.equal(cacheUpdate.$set.expiresAt.toISOString(), '2026-06-04T01:00:00.000Z')
  assert.equal(Object.hasOwn(cacheUpdate.$set, 'messages'), false)
})

test('POST /ai/summarize returns cached summary without calling Gemini', async () => {
  const conversationId = new mongoose.Types.ObjectId()
  const messageId = new mongoose.Types.ObjectId()
  let generateCalls = 0

  const router = createAiRouter({
    MessageModel: {
      find() {
        return createQuery([{ _id: messageId }])
      },
    },
    SummaryCacheModel: {
      findOne() {
        return createQuery({
          summary: 'Cached summary',
          model: 'gemini-test',
          expiresAt: new Date('2026-06-04T01:00:00.000Z'),
          messageIds: [messageId],
        })
      },
      findOneAndUpdate() {
        throw new Error('cache write should not run')
      },
    },
    async generateText() {
      generateCalls += 1
      return 'New summary'
    },
  })

  const response = await request(createApp(router)).post('/ai/summarize').send({
    conversationId: conversationId.toString(),
    messages: [{ messageId: messageId.toString(), text: 'hello' }],
  })

  assert.equal(response.status, 200)
  assert.equal(response.body.summary, 'Cached summary')
  assert.equal(response.body.cached, true)
  assert.equal(generateCalls, 0)
})

test('POST /ai/moderate blocks harmful content and warns sender', async () => {
  const router = createAiRouter({
    async moderate() {
      return {
        is_moderated: true,
        allowed: false,
        harmful: true,
        categories: ['harassment'],
        warning: 'Do not harass other users.',
      }
    },
  })

  const response = await request(createApp(router)).post('/ai/moderate').send({ text: 'bad text' })

  assert.equal(response.status, 422)
  assert.equal(response.body.error, 'message_blocked')
  assert.equal(response.body.moderation.warning, 'Do not harass other users.')
})

test('moderation uses a production-tolerant timeout and caps overrides', async () => {
  const originalTimeout = process.env.GEMINI_MODERATION_TIMEOUT_MS
  const observedTimeouts = []

  try {
    delete process.env.GEMINI_MODERATION_TIMEOUT_MS
    await moderatePlaintext('safe message', {
      async generateText(_prompt, { timeoutMs }) {
        observedTimeouts.push(timeoutMs)
        return '{"harmful":false,"categories":[],"warning":""}'
      },
    })

    process.env.GEMINI_MODERATION_TIMEOUT_MS = '60000'
    await moderatePlaintext('another safe message', {
      async generateText(_prompt, { timeoutMs }) {
        observedTimeouts.push(timeoutMs)
        return '{"harmful":false,"categories":[],"warning":""}'
      },
    })
  } finally {
    if (originalTimeout === undefined) delete process.env.GEMINI_MODERATION_TIMEOUT_MS
    else process.env.GEMINI_MODERATION_TIMEOUT_MS = originalTimeout
  }

  assert.deepEqual(observedTimeouts, [DEFAULT_MODERATION_TIMEOUT_MS, MAX_MODERATION_TIMEOUT_MS])
})

test('moderation middleware allows messages when Gemini is unavailable', async () => {
  const app = express()
  app.use(express.json())
  app.post(
    '/send',
    createContentModerationMiddleware({
      async moderate() {
        return {
          is_moderated: false,
          allowed: true,
          harmful: false,
          categories: [],
          warning: '',
          error: 'moderation_unavailable',
        }
      },
    }),
    (req, res) => res.json({ ok: true, moderation: req.aiModeration })
  )

  const response = await request(app).post('/send').send({ text: 'plain message' })

  assert.equal(response.status, 200)
  assert.equal(response.body.ok, true)
  assert.equal(response.body.moderation.is_moderated, false)
})
