import mongoose from 'mongoose'

/*
 Ephemeral indexed snippets for full-text search of encrypted chat.
 Design notes:
 - Clients MUST decrypt locally and only send a small snippet or metadata to this collection
   for indexing (do NOT send full plaintext messages unless user explicitly agrees).
 - Documents in this collection are TTL-ed to reduce privacy exposure (expireAfterSeconds).
 - The main `Message` collection never contains plaintext.
*/
const MessageSearchSchema = new mongoose.Schema(
  {
    messageId: { type: mongoose.Schema.Types.ObjectId, ref: 'Message', required: true },
    conversationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true },
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // small snippet or metadata (clients should limit size and avoid PII)
    snippet: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
)

// Text index used for $text search. Only applied to ephemeral snippets.
MessageSearchSchema.index({ snippet: 'text' })

// TTL: automatically remove ephemeral snippets after 24 hours (adjust as needed)
MessageSearchSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 })

export default mongoose.models.MessageSearch || mongoose.model('MessageSearch', MessageSearchSchema)
