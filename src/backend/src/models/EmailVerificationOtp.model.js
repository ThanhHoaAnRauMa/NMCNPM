const mongoose = require("../utils/mongoose");

const EmailVerificationOtpSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
      match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      index: true,
    },
    purpose: {
      type: String,
      enum: ["REGISTER"],
      default: "REGISTER",
      index: true,
    },
    otpHash: {
      type: String,
      required: true,
      index: true,
    },
    attempts: {
      type: Number,
      default: 0,
      min: 0,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    consumedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

EmailVerificationOtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
EmailVerificationOtpSchema.index({ email: 1, purpose: 1, createdAt: -1 });

module.exports = mongoose.models.EmailVerificationOtp || mongoose.model("EmailVerificationOtp", EmailVerificationOtpSchema);
