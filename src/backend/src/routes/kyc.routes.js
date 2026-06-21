const express = require("express");
const router = express.Router();
const kycCtrl = require("../controllers/kyc.controller");
const { verifyToken } = require("../middleware/auth.middleware");
const { requireKycReviewer } = require("../middleware/kycReviewer.middleware");

router.post("/submit", verifyToken, kycCtrl.submitKYC);

router.get("/status", verifyToken, kycCtrl.getKYCStatus);

router.get("/status/:userId", verifyToken, kycCtrl.getUserKYCStatus);

router.get("/reviews", verifyToken, requireKycReviewer, kycCtrl.listKYCReviews);
router.patch("/reviews/:recordId", verifyToken, requireKycReviewer, kycCtrl.reviewKYC);

module.exports = router;
