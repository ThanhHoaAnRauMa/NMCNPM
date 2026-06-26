const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const EmailVerificationOtp = require("../models/EmailVerificationOtp.model");
const PasswordResetToken = require("../models/PasswordResetToken.model");
const User = require("../models/User.model");
const { debugEnabled, sendPasswordReset, sendRegistrationOtp } = require("../utils/email.utils");
const { generateTokens, verifyRefreshToken } = require("../utils/jwt.utils");

const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000;
const PASSWORD_MIN_LENGTH = 8;
const OTP_EXPIRES_MINUTES = Number(process.env.EMAIL_OTP_EXPIRES_MINUTES || 10);
const PASSWORD_RESET_EXPIRES_MINUTES = Number(process.env.PASSWORD_RESET_EXPIRES_MINUTES || 30);
const MAX_OTP_ATTEMPTS = 5;

function exactCaseInsensitive(value) {
  const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^${escaped}$`, "i");
}

function normalizeUsername(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function tokenPepper() {
  return process.env.EMAIL_TOKEN_PEPPER || process.env.JWT_SECRET || "secure-chat-dev-pepper";
}

function sha256(value) {
  return crypto.createHash("sha256").update(`${value}:${tokenPepper()}`).digest("hex");
}

function generateOtp() {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
}

function generateResetToken() {
  return crypto.randomBytes(32).toString("base64url");
}

function emailVerificationRequired() {
  return process.env.EMAIL_VERIFICATION_REQUIRED !== "false";
}

function frontendUrl() {
  return (process.env.FRONTEND_URL || process.env.CORS_ORIGIN || "http://localhost:5173").split(",")[0].replace(/\/$/, "");
}

function uniqueById(users = []) {
  return users.filter((user, index, all) => user && all.findIndex((item) => item?._id.toString() === user._id.toString()) === index);
}

function isLocked(user) {
  return Boolean(user?.lockUntil && user.lockUntil > new Date());
}

async function findLoginCandidates(identifier) {
  const lowerIdentifier = identifier.toLowerCase();
  const usernameIdentifiers = [identifier];
  if (identifier.startsWith("@") && identifier.length > 1) usernameIdentifiers.push(identifier.slice(1));
  const usernameLowers = [...new Set(usernameIdentifiers.map(normalizeUsername).filter(Boolean))];

  const fastOr = usernameLowers.map((usernameLower) => ({ usernameLower }));
  if (identifier.includes("@")) fastOr.unshift({ email: lowerIdentifier });

  const fastCandidates = fastOr.length
    ? await User.find({ $or: fastOr }).select("+password +usernameLower").limit(10)
    : [];

  return { fastCandidates: uniqueById(fastCandidates), usernameIdentifiers };
}

async function findLegacyUsernameCandidates(usernameIdentifiers, knownCandidates) {
  const knownIds = new Set(knownCandidates.map((candidate) => candidate._id.toString()));
  const legacyCandidates = await User.find({
    $or: usernameIdentifiers.map((username) => ({ username: exactCaseInsensitive(username) })),
  }).select("+password +usernameLower").limit(10);
  return legacyCandidates.filter((candidate) => !knownIds.has(candidate._id.toString()));
}

function publicUser(user) {
  return {
    id: user._id,
    username: user.username,
    email: user.email,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    kycStatus: user.kycStatus,
  };
}

async function consumeRegistrationOtp(email, otp) {
  const record = await EmailVerificationOtp.findOne({
    email,
    purpose: "REGISTER",
    consumedAt: null,
    expiresAt: { $gt: new Date() },
  }).sort({ createdAt: -1 });
  if (!record) {
    const error = new Error("Email verification code is invalid or expired.");
    error.status = 400;
    error.code = "EMAIL_OTP_INVALID";
    throw error;
  }
  if (record.attempts >= MAX_OTP_ATTEMPTS) {
    const error = new Error("Email verification code has too many failed attempts.");
    error.status = 429;
    error.code = "EMAIL_OTP_LOCKED";
    throw error;
  }
  if (record.otpHash !== sha256(otp)) {
    record.attempts += 1;
    await record.save();
    const error = new Error("Email verification code is invalid or expired.");
    error.status = 400;
    error.code = "EMAIL_OTP_INVALID";
    throw error;
  }
  record.consumedAt = new Date();
  await record.save();
}

exports.sendEmailOtp = async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ success: false, message: "A valid email is required.", code: "INVALID_EMAIL" });
    }
    if (await User.exists({ email })) {
      return res.status(409).json({ success: false, message: "Email already exists.", code: "EMAIL_ALREADY_EXISTS" });
    }

    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + OTP_EXPIRES_MINUTES * 60 * 1000);
    await EmailVerificationOtp.deleteMany({ email, purpose: "REGISTER", consumedAt: null });
    await EmailVerificationOtp.create({ email, purpose: "REGISTER", otpHash: sha256(otp), expiresAt });
    await sendRegistrationOtp({ email, otp, expiresMinutes: OTP_EXPIRES_MINUTES });

    return res.json({
      success: true,
      message: "Verification code sent.",
      expiresAt,
      ...(debugEnabled() ? { debugOtp: otp } : {}),
    });
  } catch (error) {
    console.error("[sendEmailOtp]", error);
    return res.status(error.code === "EMAIL_NOT_CONFIGURED" ? 503 : 500).json({
      success: false,
      message: error.code === "EMAIL_NOT_CONFIGURED" ? "Email provider is not configured." : "Internal server error.",
      code: error.code || "SERVER_ERROR",
    });
  }
};

exports.register = async (req, res) => {
  try {
    const username = typeof req.body.username === "string" ? req.body.username.trim() : "";
    const email = normalizeEmail(req.body.email);
    const password = typeof req.body.password === "string" ? req.body.password : "";
    const confirmPassword = typeof req.body.confirmPassword === "string" ? req.body.confirmPassword : "";
    const emailOtp = typeof req.body.emailOtp === "string" ? req.body.emailOtp.trim() : "";

    if (!username || !email || !password || !confirmPassword) {
      return res.status(400).json({ success: false, message: "Username, email, password and password confirmation are required.", code: "MISSING_FIELDS" });
    }
    if (password.length < PASSWORD_MIN_LENGTH || password.length > 72) {
      return res.status(400).json({ success: false, message: "Password must contain 8 to 72 characters.", code: "INVALID_PASSWORD_LENGTH" });
    }
    if (password !== confirmPassword) {
      return res.status(400).json({ success: false, message: "Password confirmation does not match.", code: "PASSWORD_MISMATCH" });
    }
    const usernameLower = normalizeUsername(username);
    const existing = await User.findOne({
      $or: [{ email }, { usernameLower }, { username: exactCaseInsensitive(username) }],
    }).select("email username usernameLower");
    if (existing) {
      const code = existing.email === email ? "EMAIL_ALREADY_EXISTS" : "USERNAME_ALREADY_EXISTS";
      return res.status(409).json({ success: false, message: "Email or username already exists.", code });
    }
    if (emailVerificationRequired()) {
      if (!/^\d{6}$/.test(emailOtp)) {
        return res.status(400).json({ success: false, message: "A valid 6-digit email verification code is required.", code: "EMAIL_OTP_REQUIRED" });
      }
      await consumeRegistrationOtp(email, emailOtp);
    }

    const user = await User.create({ username, email, password: await bcrypt.hash(password, 12) });
    const tokens = generateTokens(user._id.toString());
    return res.status(201).json({ success: true, message: "Registration successful.", user: publicUser(user), ...tokens });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ success: false, message: error.message, code: error.code || "AUTH_ERROR" });
    }
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: "Email or username already exists.", code: "DUPLICATE_KEY" });
    }
    console.error("[register]", error);
    return res.status(500).json({ success: false, message: "Internal server error.", code: "SERVER_ERROR" });
  }
};

exports.forgotPassword = async (req, res) => {
  const responsePayload = { success: true, message: "If the account exists, a password reset link has been sent." };
  try {
    const identifier = String(req.body.identifier || req.body.email || "").trim();
    if (!identifier) {
      return res.status(400).json({ success: false, message: "Email or username is required.", code: "MISSING_IDENTIFIER" });
    }

    const normalized = normalizeEmail(identifier);
    const candidates = identifier.includes("@")
      ? await User.find({ email: normalized }).limit(2)
      : await User.find({ $or: [{ usernameLower: normalizeUsername(identifier) }, { username: exactCaseInsensitive(identifier) }] }).limit(2);
    const user = uniqueById(candidates)[0];
    if (!user) return res.json(responsePayload);

    const token = generateResetToken();
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_EXPIRES_MINUTES * 60 * 1000);
    await PasswordResetToken.deleteMany({ userId: user._id, usedAt: null });
    await PasswordResetToken.create({ userId: user._id, tokenHash: sha256(token), expiresAt });
    const resetUrl = `${frontendUrl()}/?resetToken=${encodeURIComponent(token)}`;
    await sendPasswordReset({ email: user.email, resetUrl, expiresMinutes: PASSWORD_RESET_EXPIRES_MINUTES });

    return res.json({
      ...responsePayload,
      ...(debugEnabled() ? { debugResetToken: token, resetUrl } : {}),
    });
  } catch (error) {
    console.error("[forgotPassword]", error);
    if (error.code === "EMAIL_NOT_CONFIGURED") {
      return res.status(503).json({ success: false, message: "Email provider is not configured.", code: "EMAIL_NOT_CONFIGURED" });
    }
    return res.status(500).json({ success: false, message: "Internal server error.", code: error.code || "SERVER_ERROR" });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const token = typeof req.body.token === "string" ? req.body.token.trim() : "";
    const password = typeof req.body.password === "string" ? req.body.password : "";
    const confirmPassword = typeof req.body.confirmPassword === "string" ? req.body.confirmPassword : "";
    if (!token || !password || !confirmPassword) {
      return res.status(400).json({ success: false, message: "Reset token, password and password confirmation are required.", code: "MISSING_FIELDS" });
    }
    if (password.length < PASSWORD_MIN_LENGTH || password.length > 72) {
      return res.status(400).json({ success: false, message: "Password must contain 8 to 72 characters.", code: "INVALID_PASSWORD_LENGTH" });
    }
    if (password !== confirmPassword) {
      return res.status(400).json({ success: false, message: "Password confirmation does not match.", code: "PASSWORD_MISMATCH" });
    }

    const reset = await PasswordResetToken.findOne({
      tokenHash: sha256(token),
      usedAt: null,
      expiresAt: { $gt: new Date() },
    });
    if (!reset) {
      return res.status(400).json({ success: false, message: "Password reset token is invalid or expired.", code: "RESET_TOKEN_INVALID" });
    }

    await User.findByIdAndUpdate(reset.userId, {
      password: await bcrypt.hash(password, 12),
      loginAttempts: 0,
      lockUntil: null,
    });
    reset.usedAt = new Date();
    await reset.save();
    return res.json({ success: true, message: "Password reset successful. Please log in again." });
  } catch (error) {
    console.error("[resetPassword]", error);
    return res.status(500).json({ success: false, message: "Internal server error.", code: error.code || "SERVER_ERROR" });
  }
};

exports.login = async (req, res) => {
  try {
    const providedIdentifier = typeof req.body.identifier === "string" ? req.body.identifier.trim() : "";
    const legacyEmail = typeof req.body.email === "string" ? req.body.email.trim() : "";
    const identifier = providedIdentifier || legacyEmail;
    const password = typeof req.body.password === "string" ? req.body.password : "";
    if (!identifier || !password) {
      return res.status(400).json({ success: false, message: "Username or email and password are required.", code: "MISSING_FIELDS" });
    }

    const { fastCandidates, usernameIdentifiers } = await findLoginCandidates(identifier);

    let user = null;
    let lockedMatch = null;
    for (const candidate of fastCandidates) {
      if (await bcrypt.compare(password, candidate.password)) {
        if (isLocked(candidate)) lockedMatch = candidate;
        else {
          user = candidate;
          break;
        }
      }
    }
    let candidates = fastCandidates;

    if (!user) {
      const legacyCandidates = await findLegacyUsernameCandidates(usernameIdentifiers, fastCandidates);
      candidates = uniqueById([...fastCandidates, ...legacyCandidates]);
      for (const candidate of legacyCandidates) {
        if (await bcrypt.compare(password, candidate.password)) {
          if (isLocked(candidate)) lockedMatch = candidate;
          else {
            user = candidate;
            break;
          }
        }
      }
    }

    if (!user) {
      const uniquelyLocked = candidates.length === 1 && isLocked(candidates[0]) ? candidates[0] : null;
      if (lockedMatch || uniquelyLocked) {
        const lockedUser = lockedMatch || uniquelyLocked;
        return res.status(423).json({ success: false, message: "Account is temporarily locked.", code: "ACCOUNT_LOCKED", lockUntil: lockedUser.lockUntil });
      }
      const failedCandidate = candidates.length === 1 ? candidates[0] : null;
      if (failedCandidate) {
        const loginAttempts = (failedCandidate.loginAttempts || 0) + 1;
        const lockUntil = loginAttempts >= MAX_LOGIN_ATTEMPTS ? new Date(Date.now() + LOCK_DURATION_MS) : null;
        await User.findByIdAndUpdate(failedCandidate._id, { loginAttempts, lockUntil });
        if (lockUntil) {
          return res.status(423).json({ success: false, message: "Account is temporarily locked.", code: "ACCOUNT_LOCKED", lockUntil });
        }
      }
      return res.status(401).json({ success: false, message: "Invalid username, email or password.", code: "INVALID_CREDENTIALS" });
    }

    const loginUpdate = { loginAttempts: 0, lockUntil: null, isOnline: true };
    if (!user.usernameLower) loginUpdate.usernameLower = normalizeUsername(user.username);
    await User.findByIdAndUpdate(user._id, loginUpdate).catch((updateError) => {
      if (updateError.code !== 11000) throw updateError;
    });
    return res.json({ success: true, message: "Login successful.", user: publicUser(user), ...generateTokens(user._id.toString()) });
  } catch (error) {
    console.error("[login]", error);
    return res.status(500).json({ success: false, message: "Internal server error.", code: "SERVER_ERROR" });
  }
};

exports.logout = async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.userId, { isOnline: false, lastSeen: new Date() });
    return res.json({ success: true, message: "Logout successful." });
  } catch (error) {
    console.error("[logout]", error);
    return res.status(500).json({ success: false, message: "Internal server error.", code: "SERVER_ERROR" });
  }
};

exports.refresh = async (req, res) => {
  try {
    if (!req.body.refreshToken) {
      return res.status(401).json({ success: false, message: "Refresh token is required.", code: "MISSING_REFRESH_TOKEN" });
    }
    const payload = verifyRefreshToken(req.body.refreshToken);
    const user = await User.exists({ _id: payload.userId });
    if (!user) {
      return res.status(401).json({ success: false, message: "Account not found.", code: "USER_NOT_FOUND" });
    }
    return res.json({ success: true, ...generateTokens(payload.userId) });
  } catch (error) {
    return res.status(403).json({ success: false, message: "Refresh token is invalid or expired.", code: error.name === "TokenExpiredError" ? "REFRESH_TOKEN_EXPIRED" : "REFRESH_TOKEN_INVALID" });
  }
};
