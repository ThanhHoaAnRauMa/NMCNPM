const mongoose = require("../utils/mongoose");
const Conversation = require("../models/Conversation.model");
const User = require("../models/User.model");
const { conversationRoomId } = require("../models/Conversation.model");
const { createConversationWithLegacyIndexRetry } = require("../utils/conversationIndexes.utils");

function validId(value) {
  return mongoose.Types.ObjectId.isValid(value);
}

function isAdmin(group, userId) {
  return group.admins.some((id) => id.toString() === userId);
}

exports.createGroup = async (req, res) => {
  try {
    const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
    const memberIds = Array.isArray(req.body.memberIds) ? req.body.memberIds : [];
    if (!name || name.length > 128 || !memberIds.length || memberIds.length > 99 || memberIds.some((id) => !validId(id))) {
      return res.status(400).json({ success: false, message: "A group name and 1 to 99 valid members are required." });
    }
    const members = [...new Set([req.userId, ...memberIds])];
    const memberUsers = await User.find({ _id: { $in: members } }).select("_id kycStatus publicKey").lean();
    if (memberUsers.length !== members.length) {
      return res.status(400).json({ success: false, message: "One or more members do not exist." });
    }
    const mode = req.body.mode === "PRIVACY" ? "PRIVACY" : "KYC";
    if (memberUsers.some((member) => !member.publicKey)) {
      return res.status(409).json({ success: false, code: "PUBLIC_KEY_REQUIRED", message: "Every group member must create and synchronize a device key before encrypted chat." });
    }
    if (mode === "KYC" && memberUsers.some((member) => String(member.kycStatus).toUpperCase() !== "VERIFIED")) {
      return res.status(403).json({ success: false, code: "KYC_REQUIRED", message: "Every group member must be KYC verified for KYC mode." });
    }
    const group = await createConversationWithLegacyIndexRetry(Conversation, { type: "GROUP", mode, members, groupName: name, createdBy: req.userId, admins: [req.userId] });
    const io = req.app.get("io");
    for (const memberId of members) {
      if (memberId !== req.userId) {
        io?.to(`user:${memberId}`).emit("conversation_created", {
          conversationId: group._id,
          roomId: group.roomId || conversationRoomId(group._id),
          type: group.type,
          mode: group.mode,
          createdBy: req.userId,
        });
      }
    }
    const groupObject = group.toObject();
    return res.status(201).json({ success: true, group: { ...groupObject, roomId: groupObject.roomId || conversationRoomId(groupObject._id) } });
  } catch (error) {
    console.error("[createGroup]", error);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

exports.getMyGroups = async (req, res) => {
  try {
    const groups = await Conversation.find({ type: { $in: ["GROUP", "group"] }, members: req.userId })
      .populate("members", "username displayName avatarUrl isOnline kycStatus publicKey")
      .populate("lastMessage")
      .sort({ updatedAt: -1 })
      .lean();
    return res.json({
      success: true,
      groups: groups.map((group) => ({ ...group, roomId: group.roomId || conversationRoomId(group._id) })),
    });
  } catch (error) {
    console.error("[getMyGroups]", error);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

exports.getMyConversations = async (req, res) => {
  try {
    const conversations = await Conversation.find({ members: req.userId })
      .populate("members", "username displayName avatarUrl isOnline lastSeen kycStatus publicKey")
      .populate({
        path: "lastMessage",
        select: "encryptedContent msgType senderId createdAt status fileMime fileName",
        populate: { path: "senderId", select: "username" },
      })
      .sort({ updatedAt: -1 })
      .lean();

    const formatted = conversations.map((conversation) => {
      const otherUser = conversation.type === "DIRECT" || conversation.type === "direct"
        ? conversation.members.find((member) => member._id.toString() !== req.userId)
        : null;
      const lastMessage = conversation.lastMessage;
      const preview = lastMessage?.msgType === "FILE"
        ? `File: ${lastMessage.fileName || "Encrypted attachment"}`
        : lastMessage
          ? "[Encrypted Message]"
          : null;

      return {
        conversationId: conversation._id,
        roomId: conversation.roomId || conversationRoomId(conversation._id),
        type: conversation.type,
        mode: conversation.mode,
        name: otherUser?.displayName || otherUser?.username || conversation.groupName || "Conversation",
        avatarUrl: otherUser?.avatarUrl || conversation.groupAvatar || null,
        isOnline: otherUser?.isOnline || false,
        lastSeen: otherUser?.lastSeen || null,
        kycStatus: otherUser?.kycStatus || null,
        otherUserId: otherUser?._id || null,
        memberCount: conversation.members.length,
        lastMessage: lastMessage
          ? {
              preview,
              encryptedContent: lastMessage.encryptedContent,
              senderId: lastMessage.senderId?._id,
              senderName: lastMessage.senderId?.username,
              msgType: lastMessage.msgType,
              status: lastMessage.status,
              createdAt: lastMessage.createdAt,
            }
          : null,
        updatedAt: conversation.updatedAt,
      };
    });

    return res.json({ success: true, conversations: formatted, count: formatted.length });
  } catch (error) {
    console.error("[getMyConversations]", error);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

exports.updateGroup = async (req, res) => {
  try {
    const group = await Conversation.findById(req.params.id);
    if (!group || !isAdmin(group, req.userId)) return res.status(403).json({ success: false, message: "Group admin access required." });
    if (typeof req.body.name === "string") group.groupName = req.body.name.trim().slice(0, 128);
    if (typeof req.body.avatarUrl === "string") group.groupAvatar = req.body.avatarUrl.trim().slice(0, 2048) || null;
    await group.save();
    return res.json({ success: true, group });
  } catch (error) {
    console.error("[updateGroup]", error);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

exports.addMember = async (req, res) => {
  try {
    const group = await Conversation.findById(req.params.id);
    if (!group || !isAdmin(group, req.userId)) return res.status(403).json({ success: false, message: "Group admin access required." });
    const user = validId(req.body.userId) ? await User.findById(req.body.userId).select("kycStatus publicKey").lean() : null;
    if (!user) {
      return res.status(400).json({ success: false, message: "Valid userId is required." });
    }
    if (!user.publicKey) {
      return res.status(409).json({ success: false, code: "PUBLIC_KEY_REQUIRED", message: "New members must create and synchronize a device key before encrypted chat." });
    }
    if (["KYC", "Standard"].includes(group.mode) && String(user.kycStatus).toUpperCase() !== "VERIFIED") {
      return res.status(403).json({ success: false, code: "KYC_REQUIRED", message: "New members of a KYC group must be KYC verified." });
    }
    await Conversation.findByIdAndUpdate(group._id, { $addToSet: { members: req.body.userId } });
    return res.json({ success: true, message: "Member added." });
  } catch (error) {
    console.error("[addMember]", error);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

exports.removeMember = async (req, res) => {
  try {
    const group = await Conversation.findById(req.params.id);
    if (!group) return res.status(404).json({ success: false, message: "Group not found." });
    const removingSelf = req.params.userId === req.userId;
    if (!removingSelf && !isAdmin(group, req.userId)) return res.status(403).json({ success: false, message: "Group admin access required." });
    const targetIsLastAdmin = group.admins.length === 1 && group.admins[0].toString() === req.params.userId;
    if (targetIsLastAdmin && group.members.length > 1) {
      return res.status(400).json({ success: false, message: "Promote another admin before the last admin leaves." });
    }
    await Conversation.findByIdAndUpdate(group._id, { $pull: { members: req.params.userId, admins: req.params.userId } });
    return res.json({ success: true, message: "Member removed." });
  } catch (error) {
    console.error("[removeMember]", error);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

exports.promoteAdmin = async (req, res) => {
  try {
    const group = await Conversation.findById(req.params.id);
    if (!group || !isAdmin(group, req.userId)) return res.status(403).json({ success: false, message: "Group admin access required." });
    if (!group.members.some((id) => id.toString() === req.body.userId)) {
      return res.status(400).json({ success: false, message: "The new admin must be a group member." });
    }
    await Conversation.findByIdAndUpdate(group._id, { $addToSet: { admins: req.body.userId } });
    return res.json({ success: true, message: "Admin promoted." });
  } catch (error) {
    console.error("[promoteAdmin]", error);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};
