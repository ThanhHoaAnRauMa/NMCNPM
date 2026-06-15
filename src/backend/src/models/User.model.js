const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, "Username là bắt buộc"],
      unique: true,
      trim: true,
      minlength: [3, "Username tối thiểu 3 ký tự"],
      maxlength: [50, "Username tối đa 50 ký tự"],
    },
    email: {
      type: String,
      required: [true, "Email là bắt buộc"],
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: [true, "Password là bắt buộc"],
    },
    publicKey: {
      type: String,
      default: null,
    },
    kycStatus: {
      type: String,
      enum: ["NONE", "PENDING", "VERIFIED"],
      default: "NONE",
    },
    avatarUrl: {
      type: String,
      default: null,
    },
    displayName: {
      type: String,
      default: null,
    },
    isOnline: {
      type: Boolean,
      default: false,
    },
    lastSeen: {
      type: Date,
      default: null,
    },
    blocklist: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    loginAttempts: {
      type: Number,
      default: 0,
    },
    lockUntil: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

UserSchema.methods.isLocked = function () {
  return this.lockUntil && this.lockUntil > new Date();
};

module.exports = mongoose.model("User", UserSchema);
