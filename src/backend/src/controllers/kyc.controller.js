const User = require("../models/User.model");
const KYCRecord = require("../models/KYCRecord.model");

exports.submitKYC = async (req, res) => {
  try {
    const { hash, signature, pubkey } = req.body;

    if (!hash || !signature || !pubkey) {
      return res.status(400).json({
        success: false,
        message: "Thiếu thông tin. Cần có hash, signature và pubkey.",
      });
    }

    const existingKYC = await KYCRecord.findOne({ userId: req.userId });
    if (existingKYC) {
      return res.status(409).json({
        success: false,
        message: "Tài khoản này đã được xác minh KYC rồi.",
        status: existingKYC.status,
      });
    }

    const kycRecord = await KYCRecord.create({
      userId: req.userId,
      docHash: hash,
      signature,
      pubkey,
      status: "VERIFIED",
      verifiedAt: new Date(),
    });

    await User.findByIdAndUpdate(req.userId, {
      kycStatus: "VERIFIED",
    });

    return res.status(201).json({
      success: true,
      message: "Xác minh KYC thành công!",
      kycRecord: {
        id: kycRecord._id,
        status: kycRecord.status,
        verifiedAt: kycRecord.verifiedAt,
      },
    });
  } catch (err) {
    console.error("[submitKYC]", err);
    return res.status(500).json({ success: false, message: "Lỗi server." });
  }
};

exports.getKYCStatus = async (req, res) => {
  try {
    const user = await User.findById(req.userId).select("kycStatus username");

    return res.status(200).json({
      success: true,
      userId: req.userId,
      username: user.username,
      kycStatus: user.kycStatus,
    });
  } catch (err) {
    console.error("[getKYCStatus]", err);
    return res.status(500).json({ success: false, message: "Lỗi server." });
  }
};

exports.getUserKYCStatus = async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select(
      "kycStatus username",
    );
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy user." });
    }

    return res.status(200).json({
      success: true,
      userId: req.params.userId,
      username: user.username,
      kycStatus: user.kycStatus,
    });
  } catch (err) {
    console.error("[getUserKYCStatus]", err);
    return res.status(500).json({ success: false, message: "Lỗi server." });
  }
};
