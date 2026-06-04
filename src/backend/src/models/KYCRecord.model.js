const mongoose = require("mongoose");

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
  },
  { timestamps: true },
);

module.exports = mongoose.model("KYCRecord", KYCRecordSchema);
