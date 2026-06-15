const express = require("express");
const router = express.Router();
const chatCtrl = require("../controllers/chat.controller");
const { verifyToken } = require("../middleware/auth.middleware");

router.get("/:conversationId/messages", verifyToken, chatCtrl.getMessages);
router.delete("/messages/:messageId", verifyToken, chatCtrl.softDeleteMessage);

module.exports = router;
