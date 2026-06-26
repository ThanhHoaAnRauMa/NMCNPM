import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import test from 'node:test'

const require = createRequire(import.meta.url)

const {
  createConversationWithLegacyIndexRetry,
  isConversationParallelArrayIndex,
  isLegacyConversationMemberUniqueIndex,
} = require('../../src/backend/src/utils/conversationIndexes.utils.js')
const Conversation = require('../../src/backend/src/models/Conversation.model.js')

test('legacy conversation member unique index detection ignores mode-aware indexes', () => {
  assert.equal(
    isLegacyConversationMemberUniqueIndex({
      name: 'legacy_member_unique',
      unique: true,
      key: { type: 1, members: 1 },
    }),
    true
  )

  assert.equal(
    isLegacyConversationMemberUniqueIndex({
      name: 'mode_aware_member_unique',
      unique: true,
      key: { type: 1, mode: 1, members: 1 },
    }),
    false
  )

  assert.equal(
    isLegacyConversationMemberUniqueIndex({
      name: 'non_unique_member_index',
      key: { type: 1, members: 1 },
    }),
    false
  )
})

test('conversation creation retries after dropping legacy unique member index', async () => {
  const droppedIndexes = []
  const payload = { type: 'DIRECT', mode: 'PRIVACY', members: ['a', 'b'] }
  const duplicateKeyError = new Error('duplicate key')
  duplicateKeyError.code = 11000

  const Conversation = {
    createCalls: 0,
    collection: {
      async indexes() {
        return [
          { name: '_id_', unique: true, key: { _id: 1 } },
          { name: 'legacy_member_unique', unique: true, key: { type: 1, members: 1 } },
        ]
      },
      async dropIndex(name) {
        droppedIndexes.push(name)
      },
    },
    async create(doc) {
      this.createCalls += 1
      if (this.createCalls === 1) {
        throw duplicateKeyError
      }
      return { _id: 'conversation-id', ...doc }
    },
  }

  const conversation = await createConversationWithLegacyIndexRetry(Conversation, payload)

  assert.equal(Conversation.createCalls, 2)
  assert.deepEqual(droppedIndexes, ['legacy_member_unique'])
  assert.deepEqual(conversation, { _id: 'conversation-id', ...payload })
})

test('conversation creation retries after dropping invalid parallel array indexes', async () => {
  const droppedIndexes = []
  const payload = { type: 'DIRECT', mode: 'PRIVACY', members: ['a', 'b'] }
  const parallelArrayError = new Error('cannot index parallel arrays [archivedFor] [members]')
  parallelArrayError.code = 171

  assert.equal(
    isConversationParallelArrayIndex({
      name: 'members_archived_parallel',
      key: { members: 1, archivedFor: 1, updatedAt: -1 },
    }),
    true
  )

  const Conversation = {
    createCalls: 0,
    collection: {
      async indexes() {
        return [
          { name: '_id_', unique: true, key: { _id: 1 } },
          { name: 'members_1_archivedFor_1_updatedAt_-1', key: { members: 1, archivedFor: 1, updatedAt: -1 } },
          { name: 'members_1_deletedFor_1_updatedAt_-1', key: { members: 1, deletedFor: 1, updatedAt: -1 } },
        ]
      },
      async dropIndex(name) {
        droppedIndexes.push(name)
      },
    },
    async create(doc) {
      this.createCalls += 1
      if (this.createCalls === 1) {
        throw parallelArrayError
      }
      return { _id: 'conversation-id', ...doc }
    },
  }

  const conversation = await createConversationWithLegacyIndexRetry(Conversation, payload)

  assert.equal(Conversation.createCalls, 2)
  assert.deepEqual(droppedIndexes, ['members_1_archivedFor_1_updatedAt_-1', 'members_1_deletedFor_1_updatedAt_-1'])
  assert.deepEqual(conversation, { _id: 'conversation-id', ...payload })
})

test('conversation model generates a bytes32 room id before insert', async () => {
  const conversation = new Conversation({
    type: 'DIRECT',
    mode: 'PRIVACY',
    members: ['507f191e810c19729de860ea', '507f191e810c19729de860eb'],
    roomId: null,
  })

  await conversation.validate()

  assert.match(conversation.roomId, /^0x[a-f0-9]{64}$/i)
  assert.ok(conversation.roomId.endsWith(String(conversation._id)))
})
