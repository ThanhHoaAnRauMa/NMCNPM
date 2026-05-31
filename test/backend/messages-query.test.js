import assert from 'node:assert/strict'
import test from 'node:test'
import mongoose from 'mongoose'

import Message from '../../src/db/models/message.js'
import { getMessagesByCursor } from '../../src/db/queries/messages.js'

function stubFind(documents, onQuery) {
  const originalFind = Message.find
  Message.find = (query) => {
    onQuery(query)
    return {
      select() {
        return this
      },
      sort() {
        return this
      },
      limit() {
        return this
      },
      lean() {
        return this
      },
      async exec() {
        return documents
      },
    }
  }
  return () => {
    Message.find = originalFind
  }
}

test('timestamp cursor carries _id to prevent skips when timestamps are equal', async () => {
  const conversationId = new mongoose.Types.ObjectId().toString()
  const timestamp = new Date('2026-05-30T00:00:00.000Z')
  const first = { _id: new mongoose.Types.ObjectId(), timestamp }
  const second = { _id: new mongoose.Types.ObjectId(), timestamp }
  const queries = []
  let restore = stubFind([first, second], (query) => queries.push(query))

  try {
    const firstPage = await getMessagesByCursor({ conversationId, limit: 1 })
    assert.equal(firstPage.messages.length, 1)
    assert.equal(firstPage.hasMore, true)

    restore()
    restore = stubFind([], (query) => queries.push(query))
    await getMessagesByCursor({ conversationId, cursor: firstPage.nextCursor })

    assert.equal(queries[1].$or.length, 2)
    assert.equal(queries[1].$or[1].timestamp.toISOString(), timestamp.toISOString())
    assert.equal(queries[1].$or[1]._id.$lt.toString(), first._id.toString())
  } finally {
    restore()
  }
})

test('cursor query rejects invalid identifiers before accessing MongoDB', async () => {
  await assert.rejects(getMessagesByCursor({ conversationId: 'invalid' }), /valid ObjectId/)
})
