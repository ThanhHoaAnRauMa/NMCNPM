import mongoose from 'mongoose'

const ConversationSchema = new mongoose.Schema(
  {
    members: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }],
      validate: {
        validator: (members) => members.length > 0 && new Set(members.map(String)).size === members.length,
        message: 'members must contain at least one unique user',
      },
    },
    type: { type: String, enum: ['direct', 'group'], default: 'direct' },
    name: { type: String, trim: true, maxlength: 128, default: null },
    admins: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    mode: { type: String, enum: ['Standard', 'Privacy'], default: 'Standard' },
  },
  { timestamps: true }
)

ConversationSchema.index({ members: 1 })
ConversationSchema.index({ updatedAt: -1 })

export default mongoose.models.Conversation || mongoose.model('Conversation', ConversationSchema)
