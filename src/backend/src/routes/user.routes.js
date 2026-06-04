const express = require("express");
const router = express.Router();
const userCtrl = require("../controllers/user.controller");
const { verifyToken } = require("../middleware/auth.middleware");

router.get("/:id/pubkey", userCtrl.getPublicKey);
router.get("/me", verifyToken, userCtrl.getMyProfile);
router.put("/profile", verifyToken, userCtrl.updateProfile);
router.get("/search", verifyToken, userCtrl.searchUsers);
router.post("/pubkey", verifyToken, userCtrl.uploadPublicKey);
router.post("/:id/block", verifyToken, userCtrl.blockUser);
router.post("/:id/unblock", verifyToken, userCtrl.unblockUser);
router.post("/:id/conversation", verifyToken, userCtrl.startDirectConversation);

module.exports = router;
