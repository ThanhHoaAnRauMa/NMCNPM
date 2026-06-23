const User = require("../models/User.model");

function reviewerEmails() {
  return new Set(
    (process.env.KYC_REVIEWER_EMAILS || "")
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
  );
}

exports.requireKycReviewer = async (req, res, next) => {
  try {
    const allowedEmails = reviewerEmails();
    if (!allowedEmails.size) {
      return res.status(403).json({ success: false, message: "KYC reviewer access is required." });
    }

    const user = await User.findById(req.userId).select("email").lean();
    if (!user || !allowedEmails.has(String(user.email || "").toLowerCase())) {
      return res.status(403).json({ success: false, message: "KYC reviewer access is required." });
    }
    return next();
  } catch (error) {
    console.error("[requireKycReviewer]", error);
    return res.status(403).json({ success: false, message: "KYC reviewer access is required." });
  }
};
