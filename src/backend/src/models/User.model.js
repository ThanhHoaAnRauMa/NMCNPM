const mongoose = require("../utils/mongoose");

const UserSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 3,
      maxlength: 64,
    },
    usernameLower: {
      type: String,
      lowercase: true,
      trim: true,
      select: false,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
      match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    },
    password: { type: String, required: true, select: false },
    publicKey: { type: String, maxlength: 16384, default: null },
    kycStatus: {
      type: String,
      enum: ["NONE", "PENDING", "VERIFIED", "REJECTED", "unverified", "pending", "verified", "rejected"],
      default: "NONE",
      index: true,
    },
    avatarUrl: { type: String, maxlength: 2048, default: null },
    displayName: { type: String, trim: true, maxlength: 80, default: null },
    isOnline: { type: Boolean, default: false },
    lastSeen: { type: Date, default: null },
    blocklist: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    loginAttempts: { type: Number, min: 0, default: 0 },
    lockUntil: { type: Date, default: null },
  },
  { timestamps: true },
);

UserSchema.pre("validate", function setNormalizedUsername() {
  if (this.username) this.usernameLower = this.username.trim().toLowerCase();
});

UserSchema.index(
  { usernameLower: 1 },
  { partialFilterExpression: { usernameLower: { $type: "string" } } },
);

UserSchema.methods.isLocked = function isLocked() {
  return Boolean(this.lockUntil && this.lockUntil > new Date());
};

module.exports = mongoose.models.User || mongoose.model("User", UserSchema);
