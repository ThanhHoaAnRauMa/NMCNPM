const Conversation = require("../models/Conversation.model");

exports.createGroup = async (req, res) => {
  try {
    const { name, memberIds } = req.body;
    const creatorId = req.userId;

    if (!name || !memberIds || memberIds.length < 1) {
      return res.status(400).json({
        success: false,
        message: "Cần có tên nhóm và ít nhất 1 thành viên khác.",
      });
    }

    const allMembers = [...new Set([creatorId, ...memberIds])];

    const group = await Conversation.create({
      type: "GROUP",
      mode: "KYC",
      members: allMembers,
      groupName: name,
      createdBy: creatorId,
      admins: [creatorId],
    });

    return res.status(201).json({ success: true, group });
  } catch (err) {
    console.error("[createGroup]", err);
    return res.status(500).json({ success: false, message: "Lỗi server." });
  }
};

exports.addMember = async (req, res) => {
  try {
    const group = await Conversation.findById(req.params.id);
    if (!group || group.type !== "GROUP") {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy nhóm." });
    }

    const isAdmin = group.admins.some((a) => a.toString() === req.userId);
    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        message: "Chỉ admin mới được thêm thành viên.",
      });
    }

    const { userId } = req.body;
    await Conversation.findByIdAndUpdate(req.params.id, {
      $addToSet: { members: userId },
    });

    return res
      .status(200)
      .json({ success: true, message: "Đã thêm thành viên." });
  } catch (err) {
    console.error("[addMember]", err);
    return res.status(500).json({ success: false, message: "Lỗi server." });
  }
};

exports.removeMember = async (req, res) => {
  try {
    const group = await Conversation.findById(req.params.id);
    if (!group || group.type !== "GROUP") {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy nhóm." });
    }

    const targetId = req.params.userId;
    const isSelf = targetId === req.userId;
    const isAdmin = group.admins.some((a) => a.toString() === req.userId);

    if (!isSelf && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: "Chỉ admin mới được xóa thành viên.",
      });
    }

    await Conversation.findByIdAndUpdate(req.params.id, {
      $pull: { members: targetId, admins: targetId },
    });

    return res
      .status(200)
      .json({ success: true, message: "Đã xóa thành viên khỏi nhóm." });
  } catch (err) {
    console.error("[removeMember]", err);
    return res.status(500).json({ success: false, message: "Lỗi server." });
  }
};

exports.promoteAdmin = async (req, res) => {
  try {
    const group = await Conversation.findById(req.params.id);
    if (!group || group.type !== "GROUP") {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy nhóm." });
    }

    const isAdmin = group.admins.some((a) => a.toString() === req.userId);
    if (!isAdmin) {
      return res
        .status(403)
        .json({ success: false, message: "Chỉ admin mới được phân quyền." });
    }

    const { userId } = req.body;
    await Conversation.findByIdAndUpdate(req.params.id, {
      $addToSet: { admins: userId },
    });

    return res
      .status(200)
      .json({ success: true, message: "Đã cấp quyền admin." });
  } catch (err) {
    console.error("[promoteAdmin]", err);
    return res.status(500).json({ success: false, message: "Lỗi server." });
  }
};

exports.getMyGroups = async (req, res) => {
  try {
    const groups = await Conversation.find({
      type: "GROUP",
      members: req.userId,
    })
      .populate("members", "username avatarUrl isOnline")
      .populate("lastMessage");

    return res.status(200).json({ success: true, groups });
  } catch (err) {
    console.error("[getMyGroups]", err);
    return res.status(500).json({ success: false, message: "Lỗi server." });
  }
};

exports.getMyConversations = async (req, res) => {
  try {
    const conversations = await Conversation.find({
      members: req.userId,
    })
      .populate(
        "members",
        "username displayName avatarUrl isOnline lastSeen kycStatus",
      )
      .populate({
        path: "lastMessage",
        select:
          "encryptedContent msgType senderId createdAt status fileMime fileName",
        populate: { path: "senderId", select: "username" },
      })
      .sort({ updatedAt: -1 });

    const formatted = conversations.map((conv) => {
      let displayInfo = {};

      if (conv.type === "DIRECT") {
        const otherUser = conv.members.find(
          (m) => m._id.toString() !== req.userId,
        );
        displayInfo = {
          name: otherUser?.displayName || otherUser?.username || "Unknown",
          avatarUrl: otherUser?.avatarUrl || null,
          isOnline: otherUser?.isOnline || false,
          lastSeen: otherUser?.lastSeen || null,
          kycStatus: otherUser?.kycStatus || "NONE",
          otherUserId: otherUser?._id || null,
        };
      } else {
        displayInfo = {
          name: conv.groupName || "Nhóm chưa đặt tên",
          avatarUrl: conv.groupAvatar || null,
          memberCount: conv.members.length,
        };
      }

      let lastMessagePreview = null;
      if (conv.lastMessage) {
        const lm = conv.lastMessage;
        if (lm.msgType === "FILE") {
          lastMessagePreview = `📎 ${lm.fileName || "File đính kèm"}`;
        } else if (lm.msgType === "SYSTEM") {
          lastMessagePreview = lm.encryptedContent;
        } else {
          lastMessagePreview = "[Encrypted Message]";
        }
      }

      return {
        conversationId: conv._id,
        type: conv.type,
        mode: conv.mode,
        ...displayInfo,
        lastMessage: conv.lastMessage
          ? {
              preview: lastMessagePreview,
              encryptedContent: conv.lastMessage.encryptedContent,
              senderId: conv.lastMessage.senderId?._id,
              senderName: conv.lastMessage.senderId?.username,
              msgType: conv.lastMessage.msgType,
              status: conv.lastMessage.status,
              createdAt: conv.lastMessage.createdAt,
            }
          : null,
        updatedAt: conv.updatedAt,
      };
    });

    return res.status(200).json({
      success: true,
      conversations: formatted,
      count: formatted.length,
    });
  } catch (err) {
    console.error("[getMyConversations]", err);
    return res.status(500).json({ success: false, message: "Lỗi server." });
  }
};
