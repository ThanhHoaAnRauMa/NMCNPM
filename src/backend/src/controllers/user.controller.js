const User = require("../models/User.model");

exports.uploadPublicKey = async (req, res) => {
  try {
    const { publicKey } = req.body;

    if (!publicKey) {
      return res.status(400).json({
        success: false,
        message: "Thiếu publicKey.",
      });
    }

    await User.findByIdAndUpdate(req.userId, { publicKey });

    return res.status(200).json({
      success: true,
      message: "Upload public key thành công.",
    });
  } catch (err) {
    console.error("[uploadPublicKey]", err);
    return res.status(500).json({ success: false, message: "Lỗi server." });
  }
};

exports.getPublicKey = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select(
      "publicKey username",
    );

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy user." });
    }
    if (!user.publicKey) {
      return res.status(404).json({
        success: false,
        message: "User này chưa upload public key.",
      });
    }

    return res.status(200).json({
      success: true,
      userId: req.params.id,
      username: user.username,
      publicKey: user.publicKey,
    });
  } catch (err) {
    console.error("[getPublicKey]", err);
    return res.status(500).json({ success: false, message: "Lỗi server." });
  }
};

exports.blockUser = async (req, res) => {
  try {
    const blockerId = req.userId;
    const blockedId = req.params.id;

    if (blockerId === blockedId) {
      return res
        .status(400)
        .json({ success: false, message: "Không thể block chính mình." });
    }

    const targetUser = await User.findById(blockedId);
    if (!targetUser) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy user." });
    }

    await User.findByIdAndUpdate(blockerId, {
      $addToSet: { blocklist: blockedId },
    });

    return res.status(200).json({
      success: true,
      message: `Đã block user ${targetUser.username}.`,
    });
  } catch (err) {
    console.error("[blockUser]", err);
    return res.status(500).json({ success: false, message: "Lỗi server." });
  }
};

exports.unblockUser = async (req, res) => {
  try {
    const blockerId = req.userId;
    const blockedId = req.params.id;

    await User.findByIdAndUpdate(blockerId, {
      $pull: { blocklist: blockedId },
    });

    return res.status(200).json({
      success: true,
      message: "Đã unblock user.",
    });
  } catch (err) {
    console.error("[unblockUser]", err);
    return res.status(500).json({ success: false, message: "Lỗi server." });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const { displayName, avatarUrl } = req.body;
    const updateFields = {};
    if (displayName !== undefined)
      updateFields.displayName = displayName.trim();
    if (avatarUrl !== undefined) updateFields.avatarUrl = avatarUrl;

    if (Object.keys(updateFields).length === 0) {
      return res.status(400).json({
        success: false,
        message: "Không có thông tin nào được cập nhật.",
      });
    }

    const user = await User.findByIdAndUpdate(req.userId, updateFields, {
      new: true,
    }).select("-password -loginAttempts -lockUntil -blocklist");

    return res.status(200).json({
      success: true,
      message: "Cập nhật hồ sơ thành công.",
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        kycStatus: user.kycStatus,
        isOnline: user.isOnline,
        lastSeen: user.lastSeen,
      },
    });
  } catch (err) {
    console.error("[updateProfile]", err);
    return res.status(500).json({ success: false, message: "Lỗi server." });
  }
};

exports.getMyProfile = async (req, res) => {
  try {
    const user = await User.findById(req.userId).select(
      "-password -loginAttempts -lockUntil -blocklist",
    );

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy user." });
    }

    return res.status(200).json({
      success: true,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        kycStatus: user.kycStatus,
        publicKey: user.publicKey,
        isOnline: user.isOnline,
        lastSeen: user.lastSeen,
        createdAt: user.createdAt,
      },
    });
  } catch (err) {
    console.error("[getMyProfile]", err);
    return res.status(500).json({ success: false, message: "Lỗi server." });
  }
};

exports.searchUsers = async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || q.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: "Từ khóa tìm kiếm phải có ít nhất 2 ký tự.",
      });
    }

    const keyword = q.trim();

    const users = await User.find({
      _id: { $ne: req.userId },
      $or: [
        { username: { $regex: keyword, $options: "i" } },
        { email: { $regex: keyword, $options: "i" } },
      ],
    })
      .select(
        "username email displayName avatarUrl kycStatus isOnline lastSeen",
      )
      .limit(10);

    return res.status(200).json({
      success: true,
      users,
      count: users.length,
    });
  } catch (err) {
    console.error("[searchUsers]", err);
    return res.status(500).json({ success: false, message: "Lỗi server." });
  }
};

exports.startDirectConversation = async (req, res) => {
  try {
    const Conversation = require("../models/Conversation.model");

    const myId = req.userId;
    const otherId = req.params.id;

    if (myId === otherId) {
      return res.status(400).json({
        success: false,
        message: "Không thể tự nhắn tin cho chính mình.",
      });
    }

    const otherUser = await User.findById(otherId).select(
      "username avatarUrl kycStatus",
    );
    if (!otherUser) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy user." });
    }

    const existing = await Conversation.findOne({
      type: "DIRECT",
      members: { $all: [myId, otherId], $size: 2 },
    });

    if (existing) {
      return res.status(200).json({
        success: true,
        conversationId: existing._id,
        isNew: false,
        otherUser,
      });
    }

    const conversation = await Conversation.create({
      type: "DIRECT",
      mode: "KYC",
      members: [myId, otherId],
    });

    return res.status(201).json({
      success: true,
      conversationId: conversation._id,
      isNew: true,
      otherUser,
    });
  } catch (err) {
    console.error("[startDirectConversation]", err);
    return res.status(500).json({ success: false, message: "Lỗi server." });
  }
};
