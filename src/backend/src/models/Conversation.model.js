const mongoose = require("../utils/mongoose");

function conversationRoomId(value) {
  const hex = String(value || "").toLowerCase();
  if (/^[a-f0-9]{64}$/.test(hex)) return `0x${hex}`;
  if (/^0x[a-f0-9]{64}$/.test(hex)) return hex;
  if (/^[a-f0-9]{24}$/.test(hex)) return `0x${hex.padStart(64, "0")}`;
  return null;
}

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
    roomId: {
      type: String,
      default() {
        return conversationRoomId(this._id);
      },
      match: /^0x[a-f0-9]{64}$/i,
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
    clearedFor: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        clearedAt: { type: Date, required: true, default: Date.now },
      },
    ],
    readBy: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        lastReadAt: { type: Date, required: true, default: Date.now },
      },
    ],
  },
  { timestamps: true },
);

ConversationSchema.pre("validate", function ensureRoomId() {
  if (!this.roomId) {
    this.roomId = conversationRoomId(this._id);
  }
});

ConversationSchema.index({ members: 1, updatedAt: -1 });
ConversationSchema.index({ type: 1, members: 1 });
ConversationSchema.index({ type: 1, mode: 1, members: 1 });
ConversationSchema.index({ "readBy.userId": 1 });
ConversationSchema.index({ "clearedFor.userId": 1 });
ConversationSchema.index({ roomId: 1 }, { unique: true, sparse: true });

const Conversation = mongoose.models.Conversation || mongoose.model("Conversation", ConversationSchema);

module.exports = Conversation;
module.exports.conversationRoomId = conversationRoomId;
