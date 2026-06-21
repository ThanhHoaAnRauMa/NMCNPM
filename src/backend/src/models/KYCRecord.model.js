const mongoose = require("../utils/mongoose");

const KYCRecordSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },

    docHash: {
      type: String,
      required: true,
    },
    signature: {
      type: String,
      required: true,
    },

    pubkey: {
      type: String,
      required: true,
    },

    status: {
      type: String,
      enum: ["PENDING", "VERIFIED", "REJECTED"],
      default: "PENDING",
    },

    verifiedAt: {
      type: Date,
      default: null,
    },
    reviewedAt: { type: Date, default: null },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    rejectionReason: { type: String, trim: true, maxlength: 500, default: null },
  },
  { timestamps: true },
);

KYCRecordSchema.index({ status: 1, createdAt: 1, _id: 1 });

module.exports =
  mongoose.models.KYCRecord || mongoose.model("KYCRecord", KYCRecordSchema);
