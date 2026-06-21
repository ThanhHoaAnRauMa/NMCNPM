import mongoose from 'mongoose'

const KYCRecordSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    // Identity documents and photos must never be persisted in this collection.
    docHash: { type: String, required: true, match: /^[a-f0-9]{64}$/i },
    signature: { type: String, required: true },
    pubkey: { type: String, required: true, maxlength: 16384 },
    status: {
      type: String,
      enum: ['PENDING', 'VERIFIED', 'REJECTED'],
      default: 'PENDING',
    },
    verifiedAt: { type: Date, default: null },
    reviewedAt: { type: Date, default: null },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    rejectionReason: { type: String, trim: true, maxlength: 500, default: null },
  },
  { timestamps: true }
)

KYCRecordSchema.index({ status: 1, createdAt: 1, _id: 1 })

export default mongoose.models.KYCRecord || mongoose.model('KYCRecord', KYCRecordSchema)
