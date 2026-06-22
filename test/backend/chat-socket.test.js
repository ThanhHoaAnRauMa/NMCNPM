import assert from 'node:assert/strict'
import { webcrypto } from 'node:crypto'
import { createRequire } from 'node:module'
import test from 'node:test'

const require = createRequire(import.meta.url)
const Conversation = require('../../src/backend/src/models/Conversation.model.js')
const Message = require('../../src/backend/src/models/Message.model.js')
const User = require('../../src/backend/src/models/User.model.js')
const registerChatSocket = require('../../src/backend/src/socket/chat.socket.js')

test('persisted send joins creator before broadcasting when explicit join is still pending', async () => {
  const encryptedContent = 'ciphertext'
  const signingPair = await webcrypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
  const signing = await webcrypto.subtle.exportKey('jwk', signingPair.publicKey)
  const signatureBytes = await webcrypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, signingPair.privateKey, new TextEncoder().encode(encryptedContent))
  const signature = Buffer.from(signatureBytes).toString('base64')
  const publicKey = JSON.stringify({ v: 1, encryption: { kty: 'RSA' }, signing })
  const originals = {
    conversationExists: Conversation.exists,
    conversationFindOne: Conversation.findOne,
    conversationUpdate: Conversation.findByIdAndUpdate,
    messageCreate: Message.create,
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
            broadcasts.push({ event, payload, senderWasJoined: rooms.has(String(roomId)) })
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
    User.findById = originals.userFindById
    User.findByIdAndUpdate = originals.userUpdate
  }
})
