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
    signature: { type: String, required: true, maxlength: 16384 },
    senderPublicKey: { type: String, maxlength: 16384, default: null },
    timestamp: { type: Date, default: Date.now, required: true },
    contentHash: { type: String, match: /^[a-f0-9]{64}$/i },
    // Optional client id lets the chat service reject retries without storing plaintext.
    clientMessageId: { type: String, trim: true, maxlength: 128, default: null },
    msgType: { type: String, enum: ['TEXT', 'FILE', 'SYSTEM'], default: 'TEXT' },
    status: { type: String, enum: ['SENT', 'DELIVERED', 'SEEN'], default: 'SENT' },
    fileUrl: { type: String, default: null },
    fileName: { type: String, maxlength: 255, default: null },
    fileMime: { type: String, maxlength: 127, default: null },
    fileSizeBytes: { type: Number, min: 0, default: null },
    filePublicId: { type: String, default: null },
    replyTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Message', default: null },
    deletedForSender: { type: Boolean, default: false },
  },
  { timestamps: true }
)

MessageSchema.index({ conversationId: 1, timestamp: -1, _id: -1 })
MessageSchema.index({ senderId: 1, timestamp: -1, _id: -1 })
MessageSchema.index({ conversationId: 1, senderId: 1, timestamp: -1, _id: -1 })
MessageSchema.index({ conversationId: 1, msgType: 1, createdAt: -1, _id: -1 })
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
