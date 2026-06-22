import mongoose from 'mongoose'

const KYCRecordSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    // Identity documents and photos must never be persisted in this collection.
    docHash: { type: String, required: true, match: /^[a-f0-9]{64}$/i },
    signature: { type: String, required: true },
    pubkey: { type: String, required: true, maxlength: 16384 },
    fullName: { type: String, trim: true, maxlength: 120, default: null },
    citizenId: { type: String, match: /^\d{12}$/, default: null },
    dateOfBirth: { type: Date, default: null },
    address: { type: String, trim: true, maxlength: 500, default: null },
    documentFrontPublicId: { type: String, default: null },
    documentFrontFormat: { type: String, default: null },
    documentBackPublicId: { type: String, default: null },
    documentBackFormat: { type: String, default: null },
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
KYCRecordSchema.index({ citizenId: 1 }, { unique: true, partialFilterExpression: { citizenId: { $type: 'string' } } })

export default mongoose.models.KYCRecord || mongoose.model('KYCRecord', KYCRecordSchema)
