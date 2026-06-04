const express = require("express");
const router = express.Router();
const Message = require("../models/Message.model");
const { verifyToken } = require("../middleware/auth.middleware");

router.get("/:conversationId/messages", verifyToken, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { before, limit = 20 } = req.query;

    const query = { conversationId };
    if (before) {
      query._id = { $lt: before };
    }

    const messages = await Message.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .populate("senderId", "username avatarUrl");

    const nextCursor =
      messages.length === parseInt(limit)
        ? messages[messages.length - 1]._id
        : null;

    return res.status(200).json({
      success: true,
      messages: messages.reverse(),
      nextCursor,
    });
  } catch (err) {
    console.error("[getMessages]", err);
    return res.status(500).json({ success: false, message: "Lỗi server." });
  }
});

router.delete("/messages/:messageId", verifyToken, async (req, res) => {
  try {
    const message = await Message.findById(req.params.messageId);

    if (!message) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy tin nhắn." });
    }

    if (message.senderId.toString() !== req.userId) {
      return res.status(403).json({
        success: false,
        message: "Bạn chỉ có thể xóa tin nhắn của chính mình.",
      });
    }

    await Message.findByIdAndUpdate(req.params.messageId, {
      deletedForSender: true,
    });

    return res.status(200).json({
      success: true,
      message:
        "Đã xóa tin nhắn (chỉ xóa phía bạn). Tin nhắn vẫn còn trong log của đối phương.",
      messageId: req.params.messageId,
    });
  } catch (err) {
    console.error("[softDeleteMessage]", err);
    return res.status(500).json({ success: false, message: "Lỗi server." });
  }
});

module.exports = router;
