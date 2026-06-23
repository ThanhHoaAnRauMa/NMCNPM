const express = require("express");
const chatController = require("../controllers/chat.controller");
const { verifyToken } = require("../middleware/auth.middleware");

const router = express.Router();

router.use(verifyToken);
router.get("/conversations", chatController.getConversations);
router.patch("/conversations/:conversationId/archive", chatController.setConversationArchive);
router.delete("/conversations/:conversationId", chatController.deleteConversationForUser);
router.get("/:conversationId/messages", chatController.getMessages);
router.delete("/messages/:messageId", chatController.softDeleteMessage);

module.exports = router;
