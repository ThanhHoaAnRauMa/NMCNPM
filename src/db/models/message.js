import mongoose from 'mongoose'
import crypto from 'crypto'

/*
 Message model stores E2E encrypted payload only.
 NEVER store plaintext message content in this collection.
 For search, use an ephemeral index collection (`MessageSearch`) that is TTL-cleaned.
*/
const MessageSchema = new mongoose.Schema(
  {
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
    },
    // encryptedContent: ciphertext produced by client-side E2E encryption
    encryptedContent: { type: String, required: true },
    // signature of the (ciphertext or the message metadata) produced by sender's private key
    signature: { type: String, required: true },
    // message timestamp (used for ordering)
    timestamp: { type: Date, default: Date.now, index: true },
    // contentHash is a hash of the encryptedContent (or optionally of plaintext computed client-side)
    // storing a hash is allowed (not plaintext) and helps verification/integrity checks.
    contentHash: { type: String },
  },
  // we keep timestamps minimal; timestamp field provides ordering
  { timestamps: false }
)

// Compound indexes to support fast cursor queries (Task 3 requirement)
MessageSchema.index({ conversationId: 1, timestamp: -1 })
MessageSchema.index({ senderId: 1, timestamp: -1 })

// compute a hash of encryptedContent for integrity if not provided
MessageSchema.pre('save', function (next) {
  if (!this.contentHash && this.encryptedContent) {
    try {
      this.contentHash = crypto.createHash('sha256').update(this.encryptedContent).digest('hex')
    } catch (err) {
      // ignore hashing error, allow save to proceed
    }
  }
  next()
})

export default mongoose.models.Message || mongoose.model('Message', MessageSchema)
