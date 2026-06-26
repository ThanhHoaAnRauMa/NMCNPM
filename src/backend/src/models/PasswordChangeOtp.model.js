const mongoose = require("../utils/mongoose");

const PasswordChangeOtpSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    otpHash: { type: String, required: true, select: false },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
    attempts: { type: Number, min: 0, default: 0 },
  },
  { timestamps: true },
);

module.exports = mongoose.models.PasswordChangeOtp || mongoose.model("PasswordChangeOtp", PasswordChangeOtpSchema);
