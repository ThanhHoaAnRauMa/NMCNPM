const mongoose = require("../utils/mongoose");

const ConversationSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["DIRECT", "GROUP"],
      required: true,
    },
    mode: {
      type: String,
      enum: ["KYC", "PRIVACY"],
      default: "KYC",
    },
    members: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    groupName: {
      type: String,
      default: null,
    },
    groupAvatar: {
      type: String,
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    admins: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    lastMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },
    archivedFor: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    deletedFor: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
  },
  { timestamps: true },
);

ConversationSchema.index({ members: 1, updatedAt: -1 });
ConversationSchema.index({ members: 1, archivedFor: 1, updatedAt: -1 });
ConversationSchema.index({ members: 1, deletedFor: 1, updatedAt: -1 });
ConversationSchema.index({ type: 1, members: 1 });
ConversationSchema.index({ type: 1, mode: 1, members: 1 });

module.exports =
  mongoose.models.Conversation || mongoose.model("Conversation", ConversationSchema);
