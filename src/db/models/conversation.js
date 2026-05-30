import mongoose from 'mongoose'

const ConversationSchema = new mongoose.Schema(
  {
    members: [
      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    ],
    // mode: Standard = normal conversation, Privacy = additional privacy controls
    mode: { type: String, enum: ['Standard', 'Privacy'], default: 'Standard' },
  },
  { timestamps: true }
)

export default mongoose.models.Conversation || mongoose.model('Conversation', ConversationSchema)
