const express = require("express");
const router = express.Router();
const authCtrl = require("../controllers/auth.controller");
const { verifyToken } = require("../middleware/auth.middleware");
const { createRateLimiter } = require("../middleware/rateLimit.middleware");

const authLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 30, key: (req) => req.body?.identifier || req.body?.email || req.body?.username || req.ip });
const refreshLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 60 });
const emailLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 8, key: (req) => req.body?.email || req.body?.identifier || req.ip });

router.post("/email-otp", emailLimiter, authCtrl.sendEmailOtp);
router.post("/register", authLimiter, authCtrl.register);

router.post("/login", authLimiter, authCtrl.login);
router.post("/logout", verifyToken, authCtrl.logout);
router.post("/forgot-password", emailLimiter, authCtrl.forgotPassword);
router.post("/reset-password", authLimiter, authCtrl.resetPassword);

router.post("/refresh", refreshLimiter, authCtrl.refresh);

module.exports = router;
