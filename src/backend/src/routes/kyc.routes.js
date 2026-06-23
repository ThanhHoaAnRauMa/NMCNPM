const express = require("express");
const router = express.Router();
const kycCtrl = require("../controllers/kyc.controller");
const { verifyToken } = require("../middleware/auth.middleware");
const { requireKycReviewer } = require("../middleware/kycReviewer.middleware");
const upload = require("../middleware/upload.middleware");

router.post("/submit", verifyToken, (req, res, next) => {
  upload.fields([{ name: "documentFront", maxCount: 1 }, { name: "documentBack", maxCount: 1 }])(req, res, (error) => {
    if (!error) return next();
    if (error.code === "LIMIT_FILE_SIZE") return res.status(413).json({ success: false, message: "Each KYC image must fit the configured upload limit." });
    return res.status(400).json({ success: false, message: error.message });
  });
}, kycCtrl.submitKYC);

router.get("/me", verifyToken, kycCtrl.getMyKYCRecord);

router.get("/status", verifyToken, kycCtrl.getKYCStatus);

router.get("/status/:userId", verifyToken, kycCtrl.getUserKYCStatus);

router.get("/reviews", verifyToken, requireKycReviewer, kycCtrl.listKYCReviews);
router.patch("/reviews/:recordId", verifyToken, requireKycReviewer, kycCtrl.reviewKYC);

module.exports = router;
