import mongoose from 'mongoose'

const KYCRecordSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // Identity documents and photos must never be persisted in this collection.
    hash: { type: String, required: true, match: /^(0x)?[a-f0-9]{64}$/i },
    signature: { type: String, required: true },
    publicKey: { type: String, trim: true, maxlength: 8192, default: null },
    status: {
      type: String,
      enum: ['pending', 'verified', 'rejected'],
      default: 'pending',
    },
    verifiedAt: { type: Date, default: null },
  },
  { timestamps: true }
)

KYCRecordSchema.index({ userId: 1, createdAt: -1 })
KYCRecordSchema.index({ hash: 1 })

export default mongoose.models.KYCRecord || mongoose.model('KYCRecord', KYCRecordSchema)
