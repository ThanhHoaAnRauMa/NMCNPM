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
