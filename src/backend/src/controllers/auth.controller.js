const bcrypt = require("bcryptjs");
const User = require("../models/User.model");
const { generateTokens, verifyRefreshToken } = require("../utils/jwt.utils");

const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000;

exports.register = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng điền đầy đủ username, email và password.",
        code: "MISSING_FIELDS",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password phải có ít nhất 6 ký tự.",
        code: "PASSWORD_TOO_SHORT",
      });
    }

    const emailExists = await User.findOne({ email });
    if (emailExists) {
      return res.status(409).json({
        success: false,
        message:
          "Email này đã được đăng ký. Vui lòng dùng email khác hoặc đăng nhập.",
        code: "EMAIL_ALREADY_EXISTS",
      });
    }

    const usernameExists = await User.findOne({ username });
    if (usernameExists) {
      return res.status(409).json({
        success: false,
        message: "Username này đã có người dùng. Vui lòng chọn username khác.",
        code: "USERNAME_ALREADY_EXISTS",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      username,
      email,
      password: hashedPassword,
    });

    const { accessToken, refreshToken } = generateTokens(user._id.toString());

    return res.status(201).json({
      success: true,
      message: "Đăng ký thành công!",
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
      },
      accessToken,
      refreshToken,
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Email hoặc username đã tồn tại.",
        code: "DUPLICATE_KEY",
      });
    }
    console.error("[register error]", err);
    return res.status(500).json({
      success: false,
      message: "Lỗi server. Vui lòng thử lại sau.",
      code: "SERVER_ERROR",
    });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng điền email và password.",
        code: "MISSING_FIELDS",
      });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Email hoặc mật khẩu không đúng.",
        code: "INVALID_CREDENTIALS",
      });
    }

    if (user.isLocked && user.isLocked()) {
      const remainingMs = user.lockUntil - new Date();
      const remainingMin = Math.ceil(remainingMs / 60000);

      return res.status(423).json({
        success: false,
        message: `Tài khoản bị tạm khóa do nhập sai mật khẩu quá nhiều lần. Vui lòng thử lại sau ${remainingMin} phút.`,
        code: "ACCOUNT_LOCKED",
        lockUntil: user.lockUntil,
        remainingMin,
      });
    }

    const isValid = await bcrypt.compare(password, user.password);

    if (!isValid) {
      const newAttempts = (user.loginAttempts || 0) + 1;

      if (newAttempts >= MAX_LOGIN_ATTEMPTS) {
        const lockUntil = new Date(Date.now() + LOCK_DURATION_MS);
        await User.findByIdAndUpdate(user._id, {
          loginAttempts: newAttempts,
          lockUntil,
        });
        return res.status(423).json({
          success: false,
          message: `Bạn đã nhập sai mật khẩu ${MAX_LOGIN_ATTEMPTS} lần. Tài khoản bị tạm khóa 15 phút.`,
          code: "ACCOUNT_LOCKED",
          lockUntil,
          remainingMin: 15,
        });
      }

      await User.findByIdAndUpdate(user._id, { loginAttempts: newAttempts });
      const remaining = MAX_LOGIN_ATTEMPTS - newAttempts;

      return res.status(401).json({
        success: false,
        message: `Email hoặc mật khẩu không đúng. Còn ${remaining} lần thử trước khi tài khoản bị tạm khóa.`,
        code: "INVALID_CREDENTIALS",
        attemptsLeft: remaining,
      });
    }

    await User.findByIdAndUpdate(user._id, {
      loginAttempts: 0,
      lockUntil: null,
      isOnline: true,
    });

    const { accessToken, refreshToken } = generateTokens(user._id.toString());

    return res.status(200).json({
      success: true,
      message: "Đăng nhập thành công!",
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        kycStatus: user.kycStatus,
        avatarUrl: user.avatarUrl,
      },
      accessToken,
      refreshToken,
    });
  } catch (err) {
    console.error("[login error]", err);
    return res.status(500).json({
      success: false,
      message: "Lỗi server. Vui lòng thử lại sau.",
      code: "SERVER_ERROR",
    });
  }
};

exports.logout = async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.userId, {
      isOnline: false,
      lastSeen: new Date(),
    });

    return res.status(200).json({
      success: true,
      message: "Đăng xuất thành công.",
    });
  } catch (err) {
    console.error("[logout error]", err);
    return res.status(500).json({
      success: false,
      message: "Lỗi server.",
      code: "SERVER_ERROR",
    });
  }
};

exports.refresh = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: "Thiếu refresh token.",
        code: "MISSING_REFRESH_TOKEN",
      });
    }

    const payload = verifyRefreshToken(refreshToken);

    const user = await User.findById(payload.userId);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Tài khoản không tồn tại.",
        code: "USER_NOT_FOUND",
      });
    }

    const tokens = generateTokens(payload.userId);

    return res.status(200).json({
      success: true,
      ...tokens,
    });
  } catch (err) {
    return res.status(403).json({
      success: false,
      message:
        "Refresh token không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại.",
      code:
        err.name === "TokenExpiredError"
          ? "REFRESH_TOKEN_EXPIRED"
          : "REFRESH_TOKEN_INVALID",
    });
  }
};
