const express = require("express");
const router = express.Router();
const kycCtrl = require("../controllers/kyc.controller");
const { verifyToken } = require("../middleware/auth.middleware");

router.post("/submit", verifyToken, kycCtrl.submitKYC);

router.get("/status", verifyToken, kycCtrl.getKYCStatus);

router.get("/status/:userId", verifyToken, kycCtrl.getUserKYCStatus);

module.exports = router;
