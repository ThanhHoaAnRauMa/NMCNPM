import mongoose from 'mongoose'

const MerkleCommitSchema = new mongoose.Schema(
  {
    conversationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true },
    rootHash: { type: String, required: true, match: /^(0x)?[a-f0-9]{64}$/i },
    txHash: { type: String, match: /^0x[a-f0-9]{64}$/i },
    status: {
      type: String,
      enum: ['proposed', 'confirmed', 'disputed', 'failed'],
      default: 'proposed',
    },
    blockNumber: { type: Number, min: 0, default: null },
    leafCount: { type: Number, min: 0, default: null },
    committedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    timestamp: { type: Date, default: Date.now, required: true },
  },
  { timestamps: true }
)

MerkleCommitSchema.index({ conversationId: 1, timestamp: -1, _id: -1 })
MerkleCommitSchema.index(
  { txHash: 1 },
  { unique: true, partialFilterExpression: { txHash: { $type: 'string' } } }
)

export default mongoose.models.MerkleCommit || mongoose.model('MerkleCommit', MerkleCommitSchema)
