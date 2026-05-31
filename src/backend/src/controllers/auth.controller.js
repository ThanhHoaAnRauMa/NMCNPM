const bcrypt = require("bcryptjs");
const User = require("../models/User.model");
const { generateTokens, verifyRefreshToken } = require("../utils/jwt.utils");

exports.register = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng điền đầy đủ username, email và password.",
      });
    }

    const emailExists = await User.findOne({ email });
    if (emailExists) {
      return res.status(400).json({
        success: false,
        message: "Email này đã được đăng ký rồi.",
      });
    }

    const usernameExists = await User.findOne({ username });
    if (usernameExists) {
      return res.status(400).json({
        success: false,
        message: "Username này đã có người dùng rồi.",
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
      return res.status(400).json({
        success: false,
        message: "Email hoặc username đã tồn tại.",
      });
    }
    console.error("[register error]", err);
    return res.status(500).json({
      success: false,
      message: "Lỗi server. Vui lòng thử lại sau.",
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
      });
    }

    const user = await User.findOne({ email });

    const isValid = user
      ? await bcrypt.compare(password, user.password)
      : false;

    if (!user || !isValid) {
      return res.status(401).json({
        success: false,
        message: "Email hoặc mật khẩu không đúng.",
      });
    }

    await User.findByIdAndUpdate(user._id, { isOnline: true });

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
      });
    }

    const payload = verifyRefreshToken(refreshToken);

    const user = await User.findById(payload.userId);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Tài khoản không tồn tại.",
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
    });
  }
};
