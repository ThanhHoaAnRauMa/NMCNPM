const mongoose = require("../utils/mongoose");

const PRIVACY_DELIVERY_TTL_HOURS = Number(process.env.PRIVACY_DELIVERY_TTL_HOURS || 24);

const PrivacyDeliverySchema = new mongoose.Schema(
  {
    conversationId: { type: mongoose.Schema.Types.ObjectId, ref: "Conversation", required: true, index: true },
    recipientId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    messageId: { type: mongoose.Schema.Types.ObjectId, ref: "Message", required: true },
    tempId: { type: String, required: true, trim: true, maxlength: 128 },
    encryptedContent: { type: String, required: true },
    signature: { type: String, required: true, maxlength: 16384 },
    senderPublicKey: { type: String, maxlength: 16384, default: null },
    expiresAt: {
      type: Date,
      required: true,
      default() {
        return new Date(Date.now() + PRIVACY_DELIVERY_TTL_HOURS * 60 * 60 * 1000);
      },
      index: { expires: 0 },
    },
  },
  { timestamps: true },
);

PrivacyDeliverySchema.index({ recipientId: 1, conversationId: 1, createdAt: 1 });
PrivacyDeliverySchema.index({ recipientId: 1, tempId: 1 }, { unique: true });

module.exports = mongoose.models.PrivacyDelivery || mongoose.model("PrivacyDelivery", PrivacyDeliverySchema);
