const express = require("express");
const userController = require("../controllers/user.controller");
const { verifyToken } = require("../middleware/auth.middleware");

const router = express.Router();

router.get("/me", verifyToken, userController.getMyProfile);
router.get("/search", verifyToken, userController.searchUsers);
router.put("/profile", verifyToken, userController.updateProfile);
router.post("/pubkey", verifyToken, userController.uploadPublicKey);
router.get("/:id/pubkey", verifyToken, userController.getPublicKey);
router.post("/:id/block", verifyToken, userController.blockUser);
router.post("/:id/unblock", verifyToken, userController.unblockUser);
router.post("/:id/conversation", verifyToken, userController.startDirectConversation);

module.exports = router;
