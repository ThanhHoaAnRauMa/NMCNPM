const mongoose = require("../utils/mongoose");
const Conversation = require("../models/Conversation.model");
const User = require("../models/User.model");

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
    if ((await User.countDocuments({ _id: { $in: members } })) !== members.length) {
      return res.status(400).json({ success: false, message: "One or more members do not exist." });
    }
    const mode = req.body.mode === "PRIVACY" ? "PRIVACY" : "KYC";
    const group = await Conversation.create({ type: "GROUP", mode, members, groupName: name, createdBy: req.userId, admins: [req.userId] });
    return res.status(201).json({ success: true, group });
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
    return res.json({ success: true, groups });
  } catch (error) {
    console.error("[getMyGroups]", error);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

exports.getMyConversations = async (req, res) => {
  try {
    const conversations = await Conversation.find({ members: req.userId })
      .populate("members", "username displayName avatarUrl isOnline lastSeen kycStatus")
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
    if (!validId(req.body.userId) || !(await User.exists({ _id: req.body.userId }))) {
      return res.status(400).json({ success: false, message: "Valid userId is required." });
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
