import { concat, keccak256, toUtf8Bytes } from 'ethers'
import { verifyPayload } from './crypto.js'

function idOf(value) {
  return String(value?._id || value?.id || value || '')
}

function hashPair(left, right) {
  return keccak256(concat([left, right].sort()))
}

export function messageLeaf(message) {
  const committed = {
    messageId: idOf(message._id || message.messageId),
    conversationId: idOf(message.conversationId),
    senderId: idOf(message.senderId),
    timestamp: new Date(message.timestamp || message.createdAt).toISOString(),
    msgType: message.msgType || 'TEXT',
    encryptedContent: message.encryptedContent,
    signature: message.signature,
  }
  return keccak256(toUtf8Bytes(JSON.stringify(committed)))
}

export function buildMerkleTree(leaves) {
  if (!leaves.length) throw new Error('At least one persisted message is required.')
  const levels = [leaves]
  while (levels.at(-1).length > 1) {
    const current = levels.at(-1)
    const next = []
    for (let index = 0; index < current.length; index += 2) {
      next.push(index + 1 < current.length ? hashPair(current[index], current[index + 1]) : current[index])
    }
    levels.push(next)
  }
  return levels
}

export function merkleProof(levels, leafIndex) {
  const proof = []
  let index = leafIndex
  for (let level = 0; level < levels.length - 1; level += 1) {
    const sibling = index % 2 === 0 ? index + 1 : index - 1
    if (sibling < levels[level].length) proof.push(levels[level][sibling])
    index = Math.floor(index / 2)
  }
  return proof
}

export function verifyMerkleProof(leaf, proof, root) {
  return proof.reduce((hash, sibling) => hashPair(hash, sibling), leaf) === root
}

export function createEvidencePackage({ conversation, messages, roomId }) {
  if (!/^0x[a-f0-9]{64}$/i.test(roomId || '')) throw new Error('Room ID must be a bytes32 hex value.')
  const records = messages.map((message) => ({
    messageId: idOf(message._id),
    conversationId: idOf(message.conversationId),
    senderId: idOf(message.senderId),
    timestamp: new Date(message.timestamp || message.createdAt).toISOString(),
    msgType: message.msgType || 'TEXT',
    encryptedContent: message.encryptedContent,
    signature: message.signature,
    senderPublicKey: message.senderPublicKey || (typeof message.senderId === 'object' ? message.senderId.publicKey : null),
    plaintext: message.plaintext ?? null,
  }))
  const leaves = records.map(messageLeaf)
  const levels = buildMerkleTree(leaves)
  return {
    format: 'secure-chat-evidence',
    version: 1,
    exportedAt: new Date().toISOString(),
    conversation: { id: idOf(conversation._id), type: conversation.type, mode: conversation.mode, name: conversation.groupName || null },
    roomId,
    merkleRoot: levels.at(-1)[0],
    messages: records.map((record, index) => ({ ...record, leaf: leaves[index], proof: merkleProof(levels, index) })),
  }
}

export async function verifyEvidencePackage(evidence) {
  if (evidence?.format !== 'secure-chat-evidence' || evidence.version !== 1 || !Array.isArray(evidence.messages) || !evidence.messages.length) {
    throw new Error('Unsupported evidence package.')
  }
  const checks = await Promise.all(evidence.messages.map(async (message) => {
    const leaf = messageLeaf(message)
    return {
      messageId: message.messageId,
      leaf: leaf === message.leaf,
      proof: verifyMerkleProof(leaf, message.proof || [], evidence.merkleRoot),
      signature: await verifyPayload(message.encryptedContent, message.signature, message.senderPublicKey),
    }
  }))
  return { valid: checks.every((check) => check.leaf && check.proof && check.signature), checks }
}
