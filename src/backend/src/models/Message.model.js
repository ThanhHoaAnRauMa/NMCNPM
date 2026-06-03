const mongoose = require("mongoose");

const MessageSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    encryptedContent: {
      type: String,
      required: true,
    },
    signature: {
      type: String,
      required: true,
    },

    msgType: {
      type: String,
      enum: ["TEXT", "FILE", "SYSTEM"],
      default: "TEXT",
    },
    status: {
      type: String,
      enum: ["SENT", "DELIVERED", "SEEN"],
      default: "SENT",
    },

    fileUrl: {
      type: String,
      default: null,
    },
    fileName: {
      type: String,
      default: null,
    },
    fileMime: {
      type: String,
      default: null,
    },
    fileSizeBytes: {
      type: Number,
      default: null,
    },
    filePublicId: {
      type: String,
      default: null,
    },

    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },

    deletedForSender: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
);

MessageSchema.index({ conversationId: 1, createdAt: -1 });
MessageSchema.index({ senderId: 1 });
MessageSchema.index({ conversationId: 1, msgType: 1, createdAt: -1 });

module.exports = mongoose.model("Message", MessageSchema);
