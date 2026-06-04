const jwt = require("jsonwebtoken");
exports.verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      message: "Thiếu token. Vui lòng đăng nhập.",
    });
  }

  const token = authHeader.split(" ")[1];

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = payload.userId;
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: "Token không hợp lệ hoặc đã hết hạn.",
      code:
        err.name === "TokenExpiredError" ? "TOKEN_EXPIRED" : "TOKEN_INVALID",
    });
  }
};
