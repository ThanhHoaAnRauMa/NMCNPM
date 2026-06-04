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
      return res
        .status(403)
        .json({
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
      return res
        .status(403)
        .json({
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
