const jwt = require("jsonwebtoken");

exports.verifyToken = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization?.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, message: "Authentication token is required.", code: "TOKEN_MISSING" });
  }
  try {
    const payload = jwt.verify(authorization.slice(7), process.env.JWT_SECRET);
    if (!payload.userId) throw new Error("Token has no userId");
    req.userId = payload.userId;
    return next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Authentication token is invalid or expired.",
      code: error.name === "TokenExpiredError" ? "TOKEN_EXPIRED" : "TOKEN_INVALID",
    });
  }
};
