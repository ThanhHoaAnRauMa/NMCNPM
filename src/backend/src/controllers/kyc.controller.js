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

    const existing = await KYCRecord.findOne({ userId: req.userId });
    if (existing && existing.status !== "REJECTED") {
      return res.status(409).json({ success: false, message: "A KYC submission already exists.", status: existing.status });
    }

    const record = existing || new KYCRecord({ userId: req.userId });
    Object.assign(record, {
      docHash: hash.toLowerCase(), signature, pubkey, status: "PENDING",
      verifiedAt: null, reviewedAt: null, reviewedBy: null, rejectionReason: null,
    });
    await record.save();
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

exports.listKYCReviews = async (req, res) => {
  try {
    const status = String(req.query.status || "PENDING").toUpperCase();
    if (!["PENDING", "VERIFIED", "REJECTED"].includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid KYC status filter." });
    }
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 50, 1), 100);
    const records = await KYCRecord.find({ status })
      .sort({ createdAt: 1, _id: 1 })
      .limit(limit)
      .populate("userId", "username email displayName kycStatus publicKey")
      .lean();
    return res.json({ success: true, records });
  } catch (error) {
    console.error("[listKYCReviews]", error);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

exports.reviewKYC = async (req, res) => {
  try {
    const status = String(req.body.status || "").toUpperCase();
    const rejectionReason = typeof req.body.rejectionReason === "string" ? req.body.rejectionReason.trim() : "";
    if (!["VERIFIED", "REJECTED"].includes(status)) {
      return res.status(400).json({ success: false, message: "Status must be VERIFIED or REJECTED." });
    }
    if (status === "REJECTED" && (rejectionReason.length < 5 || rejectionReason.length > 500)) {
      return res.status(400).json({ success: false, message: "A rejection reason between 5 and 500 characters is required." });
    }

    const record = await KYCRecord.findById(req.params.recordId);
    if (!record) return res.status(404).json({ success: false, message: "KYC record not found." });
    if (String(record.userId) === String(req.userId)) {
      return res.status(403).json({ success: false, message: "Reviewers cannot approve their own KYC submission." });
    }
    if (record.status !== "PENDING") {
      return res.status(409).json({ success: false, message: "Only pending KYC submissions can be reviewed.", status: record.status });
    }
    const targetUser = await User.findById(record.userId).select("_id").lean();
    if (!targetUser) return res.status(409).json({ success: false, message: "KYC record has no matching user." });

    const previous = record.toObject();
    const reviewedAt = new Date();
    Object.assign(record, {
      status,
      reviewedAt,
      reviewedBy: req.userId,
      verifiedAt: status === "VERIFIED" ? reviewedAt : null,
      rejectionReason: status === "REJECTED" ? rejectionReason : null,
    });
    await record.save();
    try {
      await User.findByIdAndUpdate(record.userId, { kycStatus: status }, { runValidators: true });
    } catch (error) {
      await KYCRecord.updateOne({ _id: record._id }, {
        status: previous.status,
        reviewedAt: previous.reviewedAt,
        reviewedBy: previous.reviewedBy,
        verifiedAt: previous.verifiedAt,
        rejectionReason: previous.rejectionReason,
      });
      throw error;
    }

    return res.json({
      success: true,
      kycRecord: {
        id: record._id, userId: record.userId, status: record.status,
        reviewedAt: record.reviewedAt, reviewedBy: record.reviewedBy,
        verifiedAt: record.verifiedAt, rejectionReason: record.rejectionReason,
      },
    });
  } catch (error) {
    console.error("[reviewKYC]", error);
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
