const mongoose = require("../utils/mongoose");

const RegistrationOtpSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, trim: true, minlength: 3, maxlength: 64 },
    usernameLower: { type: String, required: true, lowercase: true, trim: true },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
      match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      unique: true,
    },
    passwordHash: { type: String, required: true },
    otpHash: { type: String, required: true },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
    attempts: { type: Number, min: 0, default: 0 },
  },
  { timestamps: true },
);

RegistrationOtpSchema.index({ usernameLower: 1 }, { unique: true });

module.exports = mongoose.models.RegistrationOtp || mongoose.model("RegistrationOtp", RegistrationOtpSchema);
