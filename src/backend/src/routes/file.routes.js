const express = require("express");
const fileController = require("../controllers/file.controller");
const { verifyToken } = require("../middleware/auth.middleware");
const upload = require("../middleware/upload.middleware");

const router = express.Router();

router.post("/upload", verifyToken, (req, res, next) => {
  upload.single("file")(req, res, (error) => {
    if (!error) return next();
    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({ success: false, message: `File exceeds ${process.env.MAX_FILE_SIZE_MB || 10} MB.` });
    }
    return res.status(400).json({ success: false, message: error.message });
  });
}, fileController.uploadFile);

router.get("/:conversationId", verifyToken, fileController.getFilesByConversation);
router.get("/:conversationId/jump/:messageId", verifyToken, fileController.jumpToMessage);

module.exports = router;
