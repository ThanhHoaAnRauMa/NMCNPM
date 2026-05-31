import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'

const SALT_ROUNDS = Number(process.env.SALT_ROUNDS) || 12

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
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
      match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    },
    // The field name stays compatible with the Week 1 auth contract, but only hashes are persisted.
    password: { type: String, required: true, minlength: 8, select: false },
    publicKey: { type: String, trim: true, maxlength: 8192, default: null },
    kycStatus: {
      type: String,
      enum: ['unverified', 'pending', 'verified', 'rejected'],
      default: 'unverified',
      index: true,
    },
  },
  { timestamps: true }
)

UserSchema.pre('save', async function () {
  if (!this.isModified('password')) return
  this.password = await bcrypt.hash(this.password, SALT_ROUNDS)
})

UserSchema.methods.comparePassword = function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password)
}

export default mongoose.models.User || mongoose.model('User', UserSchema)
