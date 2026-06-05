import mongoose from 'mongoose'
import crypto from 'crypto'

const MessageSchema = new mongoose.Schema(
  {
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
    },
    encryptedContent: { type: String, required: true },
    signature: { type: String, required: true },
    timestamp: { type: Date, default: Date.now, required: true },
    contentHash: { type: String, match: /^[a-f0-9]{64}$/i },
    // Optional client id lets the chat service reject retries without storing plaintext.
    clientMessageId: { type: String, trim: true, maxlength: 128, default: null },
  },
  { timestamps: false }
)

MessageSchema.index({ conversationId: 1, timestamp: -1, _id: -1 })
MessageSchema.index({ senderId: 1, timestamp: -1, _id: -1 })
MessageSchema.index({ conversationId: 1, senderId: 1, timestamp: -1, _id: -1 })
MessageSchema.index(
  { senderId: 1, clientMessageId: 1 },
  { unique: true, partialFilterExpression: { clientMessageId: { $type: 'string' } } }
)

MessageSchema.pre('save', function () {
  if (!this.contentHash && this.encryptedContent) {
    this.contentHash = crypto.createHash('sha256').update(this.encryptedContent).digest('hex')
  }
})

export default mongoose.models.Message || mongoose.model('Message', MessageSchema)
