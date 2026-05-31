import mongoose from 'mongoose'

const MessageSearchSchema = new mongoose.Schema(
  {
    messageId: { type: mongoose.Schema.Types.ObjectId, ref: 'Message', required: true },
    conversationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true },
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // Explicitly opt-in, ephemeral plaintext. Full history must never be uploaded here.
    snippet: { type: String, required: true, trim: true, maxlength: 2000 },
    createdAt: { type: Date, default: Date.now, required: true },
  },
  { timestamps: false }
)

MessageSearchSchema.index({ snippet: 'text' })
MessageSearchSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 })
MessageSearchSchema.index({ messageId: 1 }, { unique: true })
MessageSearchSchema.index({ conversationId: 1, createdAt: -1 })
MessageSearchSchema.index({ senderId: 1, createdAt: -1 })

export default mongoose.models.MessageSearch || mongoose.model('MessageSearch', MessageSearchSchema)
