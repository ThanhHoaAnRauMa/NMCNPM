const KYCRecord = require("../models/KYCRecord.model");
const User = require("../models/User.model");
const crypto = require("crypto");
const kycDocumentStorage = require("../utils/kycDocumentStorage.utils");
const signatureUtils = require("../utils/signature.utils");

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function validImageBytes(file) {
  const hex = file.buffer.subarray(0, 12).toString("hex");
  if (file.mimetype === "image/jpeg") return hex.startsWith("ffd8ff");
  if (file.mimetype === "image/png") return hex.startsWith("89504e470d0a1a0a");
  if (file.mimetype === "image/webp") return file.buffer.subarray(0, 4).toString() === "RIFF" && file.buffer.subarray(8, 12).toString() === "WEBP";
  return false;
}

function canonicalKycPayload({ fullName, citizenId, dateOfBirth, address, frontHash, backHash }) {
  return JSON.stringify({ fullName, citizenId, dateOfBirth, address, frontHash, backHash });
}

exports.submitKYC = async (req, res) => {
  try {
    const { hash, signature, pubkey } = req.body;
    const fullName = typeof req.body.fullName === "string" ? req.body.fullName.trim() : "";
    const citizenId = typeof req.body.citizenId === "string" ? req.body.citizenId.trim() : "";
    const dateOfBirth = typeof req.body.dateOfBirth === "string" ? req.body.dateOfBirth : "";
    const address = typeof req.body.address === "string" ? req.body.address.trim() : "";
    const parsedDateOfBirth = new Date(`${dateOfBirth}T00:00:00.000Z`);
    const front = req.files?.documentFront?.[0];
    const back = req.files?.documentBack?.[0];
    if (!/^[a-f0-9]{64}$/i.test(hash || "") || typeof signature !== "string" || !signature || typeof pubkey !== "string" || !pubkey) {
      return res.status(400).json({ success: false, message: "A SHA-256 hash, signature and public key are required." });
    }
    if (fullName.length < 2 || fullName.length > 120 || !/^\d{12}$/.test(citizenId) || !/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth) || Number.isNaN(parsedDateOfBirth.getTime()) || parsedDateOfBirth.toISOString().slice(0, 10) !== dateOfBirth || parsedDateOfBirth > new Date() || address.length < 5 || address.length > 500) {
      return res.status(400).json({ success: false, message: "Valid CCCD name, 12-digit number, date of birth and address are required." });
    }
    if (!front || !back || !IMAGE_TYPES.has(front.mimetype) || !IMAGE_TYPES.has(back.mimetype) || !validImageBytes(front) || !validImageBytes(back)) {
      return res.status(400).json({ success: false, message: "JPEG, PNG or WebP images of both CCCD sides are required." });
    }
    if (signature.length > 16384 || pubkey.length > 16384) {
      return res.status(400).json({ success: false, message: "KYC proof is too large." });
    }

    const payload = canonicalKycPayload({ fullName, citizenId, dateOfBirth, address, frontHash: sha256(front.buffer), backHash: sha256(back.buffer) });
    const calculatedHash = crypto.createHash("sha256").update(payload).digest("hex");
    const user = await User.findById(req.userId).select("publicKey");
    if (calculatedHash !== hash.toLowerCase() || !user?.publicKey || user.publicKey !== pubkey || !await signatureUtils.verifyEnvelopeSignature(hash.toLowerCase(), signature, pubkey)) {
      return res.status(409).json({ success: false, code: "INVALID_KYC_PROOF", message: "KYC data, images or device signature could not be verified." });
    }

    const existing = await KYCRecord.findOne({ userId: req.userId });
    if (existing?.status === "VERIFIED") {
      return res.status(409).json({ success: false, message: "KYC is already verified.", status: existing.status });
    }
    const updatingPending = existing?.status === "PENDING";

    let uploadedFront;
    let uploadedBack;
    try {
      uploadedFront = await kycDocumentStorage.uploadKycDocument(front.buffer, front.mimetype);
      uploadedBack = await kycDocumentStorage.uploadKycDocument(back.buffer, back.mimetype);
    } catch (uploadError) {
      if (uploadedFront?.publicId) await kycDocumentStorage.deleteKycDocument(uploadedFront.publicId);
      throw uploadError;
    }
    const oldDocuments = existing ? [existing.documentFrontPublicId, existing.documentBackPublicId].filter(Boolean) : [];
    const record = existing || new KYCRecord({ userId: req.userId });
    Object.assign(record, {
      docHash: hash.toLowerCase(), signature, pubkey, fullName, citizenId, dateOfBirth: parsedDateOfBirth, address,
      documentFrontPublicId: uploadedFront.publicId, documentFrontFormat: uploadedFront.format,
      documentBackPublicId: uploadedBack.publicId, documentBackFormat: uploadedBack.format,
      status: "PENDING", verifiedAt: null, reviewedAt: null, reviewedBy: null, rejectionReason: null,
    });
    try {
      await record.save();
    } catch (saveError) {
      await Promise.all([uploadedFront, uploadedBack].map((item) => kycDocumentStorage.deleteKycDocument(item.publicId)));
      throw saveError;
    }
    await Promise.all(oldDocuments.map((publicId) => kycDocumentStorage.deleteKycDocument(publicId)));
    await User.findByIdAndUpdate(req.userId, { kycStatus: "PENDING" });
    return res.status(201).json({
      success: true,
      message: updatingPending ? "KYC proof updated for review." : "KYC proof submitted for review.",
      updated: updatingPending,
      kycRecord: { id: record._id, status: record.status, verifiedAt: record.verifiedAt },
    });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ success: false, message: "A KYC submission already exists." });
    console.error("[submitKYC]", error);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

exports.getMyKYCRecord = async (req, res) => {
  try {
    const record = await KYCRecord.findOne({ userId: req.userId }).lean();
    if (!record) return res.json({ success: true, kycRecord: null });
    return res.json({
      success: true,
      kycRecord: {
        id: record._id,
        status: record.status,
        fullName: record.fullName || "",
        citizenId: record.citizenId || "",
        dateOfBirth: record.dateOfBirth ? record.dateOfBirth.toISOString().slice(0, 10) : "",
        address: record.address || "",
        hasDocumentFront: Boolean(record.documentFrontPublicId),
        hasDocumentBack: Boolean(record.documentBackPublicId),
        reviewedAt: record.reviewedAt,
        verifiedAt: record.verifiedAt,
        rejectionReason: record.rejectionReason || null,
      },
    });
  } catch (error) {
    console.error("[getMyKYCRecord]", error);
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
    const reviewRecords = records.map((record) => ({
      ...record,
      documents: record.documentFrontPublicId && record.documentBackPublicId ? {
        frontUrl: kycDocumentStorage.signedKycDocumentUrl(req, record.documentFrontPublicId, record.documentFrontFormat),
        backUrl: kycDocumentStorage.signedKycDocumentUrl(req, record.documentBackPublicId, record.documentBackFormat),
      } : null,
      documentFrontPublicId: undefined,
      documentBackPublicId: undefined,
    }));
    return res.json({ success: true, records: reviewRecords });
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

    if (status === "REJECTED") {
      const rejectedDocuments = [record.documentFrontPublicId, record.documentBackPublicId].filter(Boolean);
      await KYCRecord.updateOne({ _id: record._id }, {
        documentFrontPublicId: null, documentFrontFormat: null,
        documentBackPublicId: null, documentBackFormat: null,
      });
      await Promise.all(rejectedDocuments.map((publicId) => kycDocumentStorage.deleteKycDocument(publicId)));
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

exports.getSignedKycDocument = async (req, res) => {
  try {
    const document = await kycDocumentStorage.readSignedLocalDocument(req.params.token);
    res.setHeader("Cache-Control", "no-store, private");
    res.setHeader("Content-Type", document.mimeType);
    return res.send(document.buffer);
  } catch (error) {
    const status = error.status || (error.name === "TokenExpiredError" || error.name === "JsonWebTokenError" ? 403 : 500);
    if (status >= 500) console.error("[getSignedKycDocument]", error);
    return res.status(status).json({ success: false, message: status === 403 ? "KYC document link is invalid or expired." : "KYC document not found." });
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
