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

module.exports = router;
