import mongoose from 'mongoose'
import bcrypt from 'bcrypt'

// SALT_ROUNDS can be configured via env; default 12
const SALT_ROUNDS = Number(process.env.SALT_ROUNDS) || 12

const UserSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    // store only hashed password (never plaintext)
    password: { type: String, required: true },
    // publicKey for E2E verification/signature checking
    publicKey: { type: String },
    // KYC status: default 'unverified'
    kycStatus: {
      type: String,
      enum: ['unverified', 'pending', 'verified', 'rejected'],
      default: 'unverified',
    },
  },
  { timestamps: true }
)

// Hash password before saving if modified
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next()
  try {
    const hash = await bcrypt.hash(this.password, SALT_ROUNDS)
    this.password = hash
    return next()
  } catch (err) {
    return next(err)
  }
})

// instance method to compare password
UserSchema.methods.comparePassword = function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password)
}

export default mongoose.models.User || mongoose.model('User', UserSchema)

// NOTE: Ensure `package.json` has `"type": "module"` when using ES modules.
