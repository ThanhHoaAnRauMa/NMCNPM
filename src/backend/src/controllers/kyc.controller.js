const KYCRecord = require("../models/KYCRecord.model");
const User = require("../models/User.model");

exports.submitKYC = async (req, res) => {
  try {
    const { hash, signature, pubkey } = req.body;
    if (!/^[a-f0-9]{64}$/i.test(hash || "") || typeof signature !== "string" || !signature || typeof pubkey !== "string" || !pubkey) {
      return res.status(400).json({ success: false, message: "A SHA-256 hash, signature and public key are required." });
    }
    if (signature.length > 16384 || pubkey.length > 16384) {
      return res.status(400).json({ success: false, message: "KYC proof is too large." });
    }

    const existing = await KYCRecord.findOne({ userId: req.userId }).lean();
    if (existing) {
      return res.status(409).json({ success: false, message: "A KYC submission already exists.", status: existing.status });
    }

    const record = await KYCRecord.create({
      userId: req.userId,
      docHash: hash.toLowerCase(),
      signature,
      pubkey,
      status: "PENDING",
    });
    await User.findByIdAndUpdate(req.userId, { kycStatus: "PENDING" });
    return res.status(201).json({
      success: true,
      message: "KYC proof submitted for review.",
      kycRecord: { id: record._id, status: record.status, verifiedAt: record.verifiedAt },
    });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ success: false, message: "A KYC submission already exists." });
    console.error("[submitKYC]", error);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

exports.getKYCStatus = async (req, res) => {
  try {
    const user = await User.findById(req.userId).select("kycStatus username").lean();
    if (!user) return res.status(404).json({ success: false, message: "User not found." });
    return res.json({ success: true, userId: user._id, username: user.username, kycStatus: user.kycStatus });
  } catch (error) {
    console.error("[getKYCStatus]", error);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

exports.getUserKYCStatus = async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select("kycStatus username").lean();
    if (!user) return res.status(404).json({ success: false, message: "User not found." });
    return res.json({ success: true, userId: user._id, username: user.username, kycStatus: user.kycStatus });
  } catch (error) {
    console.error("[getUserKYCStatus]", error);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};
