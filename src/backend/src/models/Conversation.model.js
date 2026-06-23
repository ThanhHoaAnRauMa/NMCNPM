const mongoose = require("../utils/mongoose");

function conversationRoomId(value) {
  const hex = String(value || "").toLowerCase();
  if (/^[a-f0-9]{64}$/.test(hex)) return `0x${hex}`;
  if (/^0x[a-f0-9]{64}$/.test(hex)) return hex;
  if (/^[a-f0-9]{24}$/.test(hex)) return `0x${hex.padStart(64, "0")}`;
  return null;
}

function directConversationKey(leftUserId, rightUserId, mode) {
  const normalizedMode = mode === "PRIVACY" || mode === "Privacy" ? "PRIVACY" : "KYC";
  const ids = [leftUserId, rightUserId].map((id) => String(id)).sort();
  if (ids.length !== 2 || ids.some((id) => !/^[a-f0-9]{24}$/i.test(id))) return null;
  return `${normalizedMode}:${ids[0]}:${ids[1]}`;
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
    directKey: {
      type: String,
      trim: true,
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
  },
  { timestamps: true },
);

ConversationSchema.pre("validate", function setDirectKey(next) {
  if (this.type === "DIRECT" && Array.isArray(this.members) && this.members.length === 2) {
    this.directKey = directConversationKey(this.members[0], this.members[1], this.mode);
  }
  next();
});

ConversationSchema.index({ members: 1, updatedAt: -1 });
ConversationSchema.index({ members: 1, archivedFor: 1, updatedAt: -1 });
ConversationSchema.index({ members: 1, deletedFor: 1, updatedAt: -1 });
ConversationSchema.index({ type: 1, members: 1 });
ConversationSchema.index({ type: 1, mode: 1, members: 1 });
ConversationSchema.index({ roomId: 1 }, { unique: true, sparse: true });
ConversationSchema.index({ directKey: 1 }, { sparse: true });

const Conversation = mongoose.models.Conversation || mongoose.model("Conversation", ConversationSchema);

module.exports = Conversation;
module.exports.conversationRoomId = conversationRoomId;
module.exports.directConversationKey = directConversationKey;
