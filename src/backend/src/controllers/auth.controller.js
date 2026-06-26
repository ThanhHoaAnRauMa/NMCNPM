const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const RegistrationOtp = require("../models/RegistrationOtp.model");
const User = require("../models/User.model");
const { hasSmtpConfig, sendRegistrationOtpEmail } = require("../utils/email.utils");
const { generateTokens, verifyRefreshToken } = require("../utils/jwt.utils");

const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000;
const PASSWORD_MIN_LENGTH = 8;
const REGISTRATION_OTP_EXPIRES_MINUTES = Number(process.env.REGISTRATION_OTP_EXPIRES_MINUTES || 10);
const REGISTRATION_OTP_MAX_ATTEMPTS = Number(process.env.REGISTRATION_OTP_MAX_ATTEMPTS || 5);
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function exactCaseInsensitive(value) {
  const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^${escaped}$`, "i");
}

function normalizeUsername(value) {
  return String(value || "").trim().toLowerCase();
}

function generateOtp() {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
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
    blocklist: (user.blocklist || []).map((id) => id.toString()),
  };
}

function registrationPayload(body) {
  return {
    username: typeof body.username === "string" ? body.username.trim() : "",
    email: typeof body.email === "string" ? body.email.trim().toLowerCase() : "",
    password: typeof body.password === "string" ? body.password : "",
    confirmPassword: typeof body.confirmPassword === "string" ? body.confirmPassword : "",
  };
}

function validateRegistrationInput({ username, email, password, confirmPassword }) {
  if (!username || !email || !password || !confirmPassword) {
    return { status: 400, body: { success: false, message: "Username, email, password and password confirmation are required.", code: "MISSING_FIELDS" } };
  }
  if (!EMAIL_PATTERN.test(email)) {
    return { status: 400, body: { success: false, message: "Email address is invalid.", code: "INVALID_EMAIL" } };
  }
  if (password.length < PASSWORD_MIN_LENGTH || password.length > 72) {
    return { status: 400, body: { success: false, message: "Password must contain 8 to 72 characters.", code: "INVALID_PASSWORD_LENGTH" } };
  }
  if (password !== confirmPassword) {
    return { status: 400, body: { success: false, message: "Password confirmation does not match.", code: "PASSWORD_MISMATCH" } };
  }
  return null;
}

async function ensureAccountAvailable({ email, username, usernameLower }) {
  const existing = await User.findOne({
    $or: [{ email }, { usernameLower }, { username: exactCaseInsensitive(username) }],
  }).select("email username usernameLower");
  if (existing) {
    return existing.email === email ? "EMAIL_ALREADY_EXISTS" : "USERNAME_ALREADY_EXISTS";
  }

  const pending = await RegistrationOtp.findOne({
    $or: [{ email }, { usernameLower }],
  }).select("email usernameLower");
  if (pending && pending.email !== email) return "USERNAME_PENDING_VERIFICATION";
  return null;
}

exports.register = async (req, res) => {
  const payload = registrationPayload(req.body);
  const validationError = validateRegistrationInput(payload);
  if (validationError) return res.status(validationError.status).json(validationError.body);

  const { username, email, password } = payload;
  const usernameLower = normalizeUsername(username);

  try {
    const unavailableCode = await ensureAccountAvailable({ email, username, usernameLower });
    if (unavailableCode) {
      return res.status(409).json({ success: false, message: "Email or username already exists.", code: unavailableCode });
    }

    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + REGISTRATION_OTP_EXPIRES_MINUTES * 60 * 1000);
    await RegistrationOtp.deleteOne({ email });
    await RegistrationOtp.create({
      username,
      usernameLower,
      email,
      passwordHash: await bcrypt.hash(password, 12),
      otpHash: await bcrypt.hash(otp, 12),
      expiresAt,
    });

    const emailResult = await sendRegistrationOtpEmail({ email, username, otp, expiresInMinutes: REGISTRATION_OTP_EXPIRES_MINUTES });
    return res.status(200).json({
      success: true,
      message: "Registration OTP sent. Please check your email.",
      code: "REGISTRATION_OTP_SENT",
      expiresAt,
      devOtp: emailResult.skipped && !hasSmtpConfig() ? otp : undefined,
    });
  } catch (error) {
    await RegistrationOtp.deleteOne({ email }).catch(() => {});
    if (error.code === "EMAIL_NOT_CONFIGURED") {
      return res.status(500).json({ success: false, message: "Email sender is not configured.", code: "EMAIL_NOT_CONFIGURED" });
    }
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: "Email or username already exists.", code: "DUPLICATE_KEY" });
    }
    console.error("[register]", error);
    return res.status(500).json({ success: false, message: "Internal server error.", code: "SERVER_ERROR" });
  }
};

exports.verifyRegistrationOtp = async (req, res) => {
  try {
    const email = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const otp = typeof req.body.otp === "string" ? req.body.otp.trim() : "";
    if (!email || !otp) {
      return res.status(400).json({ success: false, message: "Email and OTP are required.", code: "MISSING_FIELDS" });
    }
    if (!/^\d{6}$/.test(otp)) {
      return res.status(400).json({ success: false, message: "OTP must contain 6 digits.", code: "INVALID_OTP_FORMAT" });
    }

    const pending = await RegistrationOtp.findOne({ email }).select("+passwordHash +otpHash");
    if (!pending) {
      return res.status(404).json({ success: false, message: "Registration OTP was not found or has expired.", code: "OTP_NOT_FOUND" });
    }
    if (pending.expiresAt <= new Date()) {
      await RegistrationOtp.deleteOne({ _id: pending._id });
      return res.status(410).json({ success: false, message: "Registration OTP has expired.", code: "OTP_EXPIRED" });
    }
    if (pending.attempts >= REGISTRATION_OTP_MAX_ATTEMPTS) {
      await RegistrationOtp.deleteOne({ _id: pending._id });
      return res.status(429).json({ success: false, message: "Too many OTP attempts. Please register again.", code: "OTP_ATTEMPTS_EXCEEDED" });
    }

    const isValidOtp = await bcrypt.compare(otp, pending.otpHash);
    if (!isValidOtp) {
      pending.attempts += 1;
      await pending.save();
      return res.status(401).json({ success: false, message: "OTP is incorrect.", code: "INVALID_OTP" });
    }

    const unavailableCode = await ensureAccountAvailable({ email: pending.email, username: pending.username, usernameLower: pending.usernameLower });
    if (unavailableCode && unavailableCode !== "USERNAME_PENDING_VERIFICATION") {
      await RegistrationOtp.deleteOne({ _id: pending._id });
      return res.status(409).json({ success: false, message: "Email or username already exists.", code: unavailableCode });
    }

    const user = await User.create({ username: pending.username, email: pending.email, password: pending.passwordHash });
    await RegistrationOtp.deleteOne({ _id: pending._id });
    const tokens = generateTokens(user._id.toString());
    return res.status(201).json({ success: true, message: "Registration successful.", user: publicUser(user), ...tokens });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: "Email or username already exists.", code: "DUPLICATE_KEY" });
    }
    console.error("[verifyRegistrationOtp]", error);
    return res.status(500).json({ success: false, message: "Internal server error.", code: "SERVER_ERROR" });
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
