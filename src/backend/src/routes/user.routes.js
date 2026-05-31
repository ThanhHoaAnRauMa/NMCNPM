const express = require("express");
const router = express.Router();
const userCtrl = require("../controllers/user.controller");
const { verifyToken } = require("../middleware/auth.middleware");

router.post("/pubkey", verifyToken, userCtrl.uploadPublicKey);

router.get("/:id/pubkey", userCtrl.getPublicKey);

router.post("/:id/block", verifyToken, userCtrl.blockUser);

router.post("/:id/unblock", verifyToken, userCtrl.unblockUser);

module.exports = router;
