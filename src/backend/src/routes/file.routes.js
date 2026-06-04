const express = require("express");
const router = express.Router();
const fileCtrl = require("../controllers/file.controller");
const { verifyToken } = require("../middleware/auth.middleware");
const upload = require("../middleware/upload.middleware");

router.post("/upload", verifyToken, upload.single("file"), fileCtrl.uploadFile);

router.get("/:conversationId", verifyToken, fileCtrl.getFilesByConversation);

router.get(
  "/:conversationId/jump/:messageId",
  verifyToken,
  fileCtrl.jumpToMessage,
);

module.exports = router;
