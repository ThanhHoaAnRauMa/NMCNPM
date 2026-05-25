import mongoose from 'mongoose'

const MerkleCommitSchema = new mongoose.Schema(
  {
    conversationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true },
    // root hash of the Merkle tree (SHA-256 hex)
    rootHash: { type: String, required: true },
    // blockchain transaction hash after anchoring (e.g. Sepolia tx hash)
    txHash: { type: String },
    // timestamp when commit was created (server time)
    timestamp: { type: Date, default: Date.now },
  },
  { timestamps: true }
)

MerkleCommitSchema.index({ conversationId: 1, timestamp: -1 })

export default mongoose.models.MerkleCommit || mongoose.model('MerkleCommit', MerkleCommitSchema)
