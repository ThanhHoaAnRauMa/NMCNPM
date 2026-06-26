import assert from 'node:assert/strict'
import { webcrypto } from 'node:crypto'
import { createRequire } from 'node:module'
import test from 'node:test'

const require = createRequire(import.meta.url)
const Conversation = require('../../src/backend/src/models/Conversation.model.js')
const Message = require('../../src/backend/src/models/Message.model.js')
const PrivacyDelivery = require('../../src/backend/src/models/PrivacyDelivery.model.js')
const User = require('../../src/backend/src/models/User.model.js')
const registerChatSocket = require('../../src/backend/src/socket/chat.socket.js')

async function signedEnvelope({ members = ['creator', 'invitee'] } = {}) {
  const wrappedKey = Buffer.alloc(256, 1).toString('base64')
  const encryptedContent = JSON.stringify({
    v: 1,
    kind: 'text',
    alg: 'RSA-OAEP-SHA256+A256GCM',
    iv: Buffer.alloc(12, 2).toString('base64'),
    keys: Object.fromEntries(members.map((member) => [member, wrappedKey])),
    ciphertext: Buffer.from('ciphertext').toString('base64'),
  })
  const signingPair = await webcrypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
  const signing = await webcrypto.subtle.exportKey('jwk', signingPair.publicKey)
  const signatureBytes = await webcrypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, signingPair.privateKey, new TextEncoder().encode(encryptedContent))
  const signature = Buffer.from(signatureBytes).toString('base64')
  const publicKey = JSON.stringify({ v: 1, encryption: { kty: 'RSA' }, signing })
  return { encryptedContent, publicKey, signature }
}

test('persisted send joins creator before broadcasting when explicit join is still pending', async () => {
  const { encryptedContent, publicKey, signature } = await signedEnvelope()
  const originals = {
    conversationExists: Conversation.exists,
    conversationFindOne: Conversation.findOne,
    conversationUpdate: Conversation.findByIdAndUpdate,
    messageCreate: Message.create,
    userFind: User.find,
    userFindById: User.findById,
    userUpdate: User.findByIdAndUpdate,
  }
  const handlers = new Map()
  const rooms = new Set()
  const broadcasts = []
  const socketEvents = []
  let connectionHandler

  try {
    Conversation.exists = async () => {
      await new Promise((resolve) => setTimeout(resolve, 40))
      return { _id: 'conversation-1' }
    }
    Conversation.findOne = async () => ({
      _id: 'conversation-1',
      mode: 'KYC',
      type: 'DIRECT',
      members: [{ toString: () => 'creator' }, { toString: () => 'invitee' }],
    })
    Conversation.findByIdAndUpdate = async () => null
    Message.create = async (data) => ({
      _id: 'message-1',
      ...data,
      timestamp: new Date(),
      createdAt: new Date(),
      async save() {},
    })
    User.find = () => ({
      select() {
        return {
          lean: async () => [
            { _id: 'creator', kycStatus: 'VERIFIED', publicKey },
            { _id: 'invitee', kycStatus: 'VERIFIED', publicKey },
          ],
        }
      },
    })
    User.findById = () => ({ select: async (fields) => fields === 'publicKey' ? { publicKey } : { blocklist: [] } })
    User.findByIdAndUpdate = async () => null

    const io = {
      use() {},
      on(event, handler) {
        if (event === 'connection') connectionHandler = handler
      },
      to(roomId) {
        return {
          emit(event, payload) {
            broadcasts.push({ event, payload, roomId: String(roomId), senderWasJoined: rooms.has(String(roomId)) })
          },
        }
      },
    }
    const socket = {
      id: 'socket-creator',
      userId: 'creator',
      broadcast: { emit() {} },
      emit(event, payload) {
        socketEvents.push({ event, payload })
      },
      on(event, handler) {
        handlers.set(event, handler)
      },
      async join(roomId) {
        await new Promise((resolve) => setTimeout(resolve, 5))
        rooms.add(String(roomId))
      },
      leave() {},
      to() {
        return { emit() {} }
      },
    }

    registerChatSocket(io)
    await connectionHandler(socket)

    const joinPromise = handlers.get('join_conversation')({ conversationId: 'conversation-1' })
    const sendPromise = handlers.get('send_message')({
      conversationId: 'conversation-1',
      encryptedContent,
      signature,
      tempId: 'temp-1',
    })
    await Promise.all([joinPromise, sendPromise])

    const newMessage = broadcasts.find((entry) => entry.event === 'new_message')
    assert.ok(newMessage)
    assert.equal(newMessage.senderWasJoined, true)
    assert.equal(newMessage.payload.tempId, 'temp-1')
    assert.equal(newMessage.payload.senderPublicKey, publicKey)
    const updateRooms = broadcasts
      .filter((entry) => entry.event === 'conversation_updated')
      .map((entry) => entry.roomId)
    assert.deepEqual(new Set(updateRooms), new Set(['user:creator', 'user:invitee']))

    const acceptedCount = broadcasts.filter((entry) => entry.event === 'new_message').length
    await handlers.get('send_message')({
      conversationId: 'conversation-1',
      encryptedContent,
      signature: `${signature.slice(0, -4)}AAAA`,
      tempId: 'temp-stale-key',
    })
    assert.equal(broadcasts.filter((entry) => entry.event === 'new_message').length, acceptedCount)
    assert.equal(socketEvents.find((entry) => entry.payload?.tempId === 'temp-stale-key')?.payload.code, 'KEY_MISMATCH')
  } finally {
    Conversation.exists = originals.conversationExists
    Conversation.findOne = originals.conversationFindOne
    Conversation.findByIdAndUpdate = originals.conversationUpdate
    Message.create = originals.messageCreate
    User.find = originals.userFind
    User.findById = originals.userFindById
    User.findByIdAndUpdate = originals.userUpdate
  }
})

test('privacy messages are queued as ciphertext for offline recipients and removed on ack', async () => {
  const { encryptedContent, publicKey, signature } = await signedEnvelope()
  const originals = {
    conversationFindOne: Conversation.findOne,
    conversationUpdate: Conversation.findByIdAndUpdate,
    deliveryDeleteOne: PrivacyDelivery.deleteOne,
    deliveryFind: PrivacyDelivery.find,
    deliveryFindOneAndUpdate: PrivacyDelivery.findOneAndUpdate,
    messageCreate: Message.create,
    userFindById: User.findById,
    userUpdate: User.findByIdAndUpdate,
  }
  const queuedDeliveries = []
  const deleted = []
  const handlersByUser = new Map()
  const socketEventsByUser = new Map()
  const userRoomEvents = []
  let connectionHandler

  try {
    Conversation.findOne = async () => ({
      _id: 'conversation-privacy',
      mode: 'PRIVACY',
      type: 'DIRECT',
      members: [{ toString: () => 'creator' }, { toString: () => 'invitee' }],
    })
    Conversation.findByIdAndUpdate = async () => null
    Message.create = async (data) => ({
      _id: 'privacy-message-1',
      ...data,
      timestamp: new Date('2026-06-26T08:00:00.000Z'),
      createdAt: new Date('2026-06-26T08:00:00.000Z'),
      async save() {},
    })
    User.findById = () => ({ select: async (fields) => fields === 'publicKey' ? { publicKey } : { blocklist: [] } })
    User.findByIdAndUpdate = async () => null
    PrivacyDelivery.findOneAndUpdate = async (_query, update) => {
      const delivery = {
        _id: `delivery-${queuedDeliveries.length + 1}`,
        ...update.$setOnInsert,
        createdAt: new Date('2026-06-26T08:00:00.000Z'),
      }
      queuedDeliveries.push(delivery)
      return delivery
    }
    PrivacyDelivery.find = (query) => ({
      sort() {
        return this
      },
      limit() {
        return this
      },
      lean: async () => queuedDeliveries.filter((delivery) =>
        String(delivery.recipientId) === String(query.recipientId) &&
        String(delivery.conversationId) === String(query.conversationId)
      ),
    })
    PrivacyDelivery.deleteOne = async (query) => {
      deleted.push(query)
      return { deletedCount: 1 }
    }

    const io = {
      use() {},
      on(event, handler) {
        if (event === 'connection') connectionHandler = handler
      },
      to(roomId) {
        return {
          emit(event, payload) {
            userRoomEvents.push({ event, payload, roomId: String(roomId) })
          },
        }
      },
    }

    function socketFor(userId) {
      const handlers = new Map()
      const events = []
      handlersByUser.set(userId, handlers)
      socketEventsByUser.set(userId, events)
      return {
        id: `socket-${userId}`,
        userId,
        broadcast: { emit() {} },
        emit(event, payload) {
          events.push({ event, payload })
        },
        on(event, handler) {
          handlers.set(event, handler)
        },
        async join() {},
        leave() {},
        to() {
          return { emit() {} }
        },
      }
    }

    registerChatSocket(io)
    await connectionHandler(socketFor('creator'))
    await handlersByUser.get('creator').get('send_private_message')({
      conversationId: 'conversation-privacy',
      encryptedContent,
      signature,
      tempId: 'privacy-temp-1',
    })

    assert.equal(queuedDeliveries.length, 1)
    assert.equal(queuedDeliveries[0].encryptedContent, encryptedContent)
    assert.equal(queuedDeliveries[0].messageId, 'privacy-message-1')
    assert.equal(queuedDeliveries[0].recipientId, 'invitee')
    assert.equal(userRoomEvents.some((entry) => entry.roomId === 'user:invitee' && entry.event === 'new_private_message'), true)

    await connectionHandler(socketFor('invitee'))
    await handlersByUser.get('invitee').get('join_conversation')({ conversationId: 'conversation-privacy' })
    const delivered = socketEventsByUser.get('invitee').find((entry) => entry.event === 'new_private_message')
    assert.equal(delivered.payload._id, 'privacy-message-1')
    assert.equal(delivered.payload.encryptedContent, encryptedContent)
    assert.equal(delivered.payload.queued, true)

    await handlersByUser.get('invitee').get('ack_private_message')({ tempId: 'privacy-temp-1' })
    assert.deepEqual(deleted, [{ recipientId: 'invitee', tempId: 'privacy-temp-1' }])
  } finally {
    Conversation.findOne = originals.conversationFindOne
    Conversation.findByIdAndUpdate = originals.conversationUpdate
    PrivacyDelivery.deleteOne = originals.deliveryDeleteOne
    PrivacyDelivery.find = originals.deliveryFind
    PrivacyDelivery.findOneAndUpdate = originals.deliveryFindOneAndUpdate
    Message.create = originals.messageCreate
    User.findById = originals.userFindById
    User.findByIdAndUpdate = originals.userUpdate
  }
})
