const mongoose = require("../utils/mongoose");

function reviewerIds() {
  return new Set(
    (process.env.KYC_REVIEWER_USER_IDS || "")
      .split(",")
      .map((value) => value.trim())
      .filter((value) => mongoose.isValidObjectId(value))
      .map((value) => String(value)),
  );
}

exports.requireKycReviewer = (req, res, next) => {
  if (!reviewerIds().has(String(req.userId))) {
    return res.status(403).json({ success: false, message: "KYC reviewer access is required." });
  }
  return next();
};
