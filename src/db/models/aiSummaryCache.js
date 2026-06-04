import mongoose from 'mongoose'

export const AI_SUMMARY_CACHE_TTL_SECONDS = 60 * 60

const AISummaryCacheSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
    },
    cacheKey: {
      type: String,
      required: true,
      match: /^[a-f0-9]{64}$/i,
    },
    messageIds: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Message', required: true }],
      validate: {
        validator: (messageIds) => Array.isArray(messageIds) && messageIds.length > 0,
        message: 'messageIds must contain at least one message id',
      },
    },
    summary: {
      type: String,
      required: true,
      trim: true,
      maxlength: 8000,
    },
    model: {
      type: String,
      required: true,
      trim: true,
      maxlength: 128,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  { timestamps: true }
)

AISummaryCacheSchema.index({ conversationId: 1, cacheKey: 1 }, { unique: true })
AISummaryCacheSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

export default mongoose.models.AISummaryCache ||
  mongoose.model('AISummaryCache', AISummaryCacheSchema)
