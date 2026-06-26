const express = require("express");
const router = express.Router();
const authCtrl = require("../controllers/auth.controller");
const { verifyToken } = require("../middleware/auth.middleware");
const { createRateLimiter } = require("../middleware/rateLimit.middleware");

const authLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 60 });
const refreshLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 60 });

router.post("/register", authLimiter, authCtrl.register);
router.post("/register/verify", authLimiter, authCtrl.verifyRegistrationOtp);

router.post("/login", authLimiter, authCtrl.login);
router.post("/logout", verifyToken, authCtrl.logout);
router.post("/password/otp", verifyToken, authLimiter, authCtrl.requestPasswordChangeOtp);
router.post("/password/change", verifyToken, authLimiter, authCtrl.changePassword);

router.post("/refresh", refreshLimiter, authCtrl.refresh);

module.exports = router;
