import assert from 'node:assert/strict'
import test from 'node:test'
import express from 'express'
import mongoose from 'mongoose'
import request from 'supertest'

import MessageSearch from '../../src/db/models/messageSearch.js'
import messagesRouter from '../../src/routes/messages.js'

function createApp() {
  const app = express()
  app.use(express.json())
  app.use('/messages', messagesRouter)
  return app
}

test('POST /messages/search validates ObjectId filters', async () => {
  const response = await request(createApp())
    .post('/messages/search')
    .send({ keyword: 'hello', conversationId: 'invalid' })

  assert.equal(response.status, 400)
  assert.match(response.body.error, /conversationId/)
})

test('POST /messages/search caps results and escapes untrusted snippets', async () => {
  const originalAggregate = MessageSearch.aggregate
  let pipeline
  MessageSearch.aggregate = (value) => {
    pipeline = value
    return {
      async exec() {
        return [{ snippet: '<script>alert(1)</script> hello' }]
      },
    }
  }

  try {
    const response = await request(createApp())
      .post('/messages/search')
      .send({ keyword: 'hello', limit: 1000 })

    assert.equal(response.status, 200)
    assert.equal(pipeline.find((stage) => stage.$limit).$limit, 100)
    assert.equal(
      response.body.results[0].highlightedSnippet,
      '&lt;script&gt;alert(1)&lt;/script&gt; <em>hello</em>'
    )
  } finally {
    MessageSearch.aggregate = originalAggregate
  }
})

test('POST /messages/index-snippet upserts one trimmed ephemeral snippet per message', async () => {
  const originalFindOneAndUpdate = MessageSearch.findOneAndUpdate
  const messageId = new mongoose.Types.ObjectId().toString()
  const conversationId = new mongoose.Types.ObjectId().toString()
  const senderId = new mongoose.Types.ObjectId().toString()
  let update
  let options

  MessageSearch.findOneAndUpdate = async (_filter, value, queryOptions) => {
    update = value
    options = queryOptions
    return { _id: new mongoose.Types.ObjectId() }
  }

  try {
    const response = await request(createApp()).post('/messages/index-snippet').send({
      messageId,
      conversationId,
      senderId,
      snippet: '  searchable text  ',
    })

    assert.equal(response.status, 201)
    assert.equal(update.$set.snippet, 'searchable text')
    assert.equal(options.upsert, true)
  } finally {
    MessageSearch.findOneAndUpdate = originalFindOneAndUpdate
  }
})
