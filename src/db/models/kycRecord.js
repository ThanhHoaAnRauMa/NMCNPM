import mongoose from 'mongoose'

const KYCRecordSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // SHA-256 of the identity document/photo (store only the hash, not the raw image)
    hash: { type: String, required: true },
    // signature of the KYC hash by an authority or by user (depending on workflow)
    signature: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
)

KYCRecordSchema.index({ userId: 1, createdAt: -1 })

export default mongoose.models.KYCRecord || mongoose.model('KYCRecord', KYCRecordSchema)
