const bcrypt = require("bcryptjs");
const User = require("../models/User.model");
const { generateTokens, verifyRefreshToken } = require("../utils/jwt.utils");

const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000;
const PASSWORD_MIN_LENGTH = 8;

function exactCaseInsensitive(value) {
  const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^${escaped}$`, "i");
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

exports.register = async (req, res) => {
  try {
    const username = typeof req.body.username === "string" ? req.body.username.trim() : "";
    const email = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const password = typeof req.body.password === "string" ? req.body.password : "";
    const confirmPassword = typeof req.body.confirmPassword === "string" ? req.body.confirmPassword : "";

    if (!username || !email || !password || !confirmPassword) {
      return res.status(400).json({ success: false, message: "Username, email, password and password confirmation are required.", code: "MISSING_FIELDS" });
    }
    if (password.length < PASSWORD_MIN_LENGTH || password.length > 72) {
      return res.status(400).json({ success: false, message: "Password must contain 8 to 72 characters.", code: "INVALID_PASSWORD_LENGTH" });
    }
    if (password !== confirmPassword) {
      return res.status(400).json({ success: false, message: "Password confirmation does not match.", code: "PASSWORD_MISMATCH" });
    }

    const existing = await User.findOne({
      $or: [{ email }, { username: exactCaseInsensitive(username) }],
    }).select("email username");
    if (existing) {
      const code = existing.email === email ? "EMAIL_ALREADY_EXISTS" : "USERNAME_ALREADY_EXISTS";
      return res.status(409).json({ success: false, message: "Email or username already exists.", code });
    }

    const user = await User.create({ username, email, password: await bcrypt.hash(password, 12) });
    const tokens = generateTokens(user._id.toString());
    return res.status(201).json({ success: true, message: "Registration successful.", user: publicUser(user), ...tokens });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: "Email or username already exists.", code: "DUPLICATE_KEY" });
    }
    console.error("[register]", error);
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

    const usernameLogin = !identifier.includes("@");
    const candidates = usernameLogin
      ? await User.find({ username: exactCaseInsensitive(identifier) }).select("+password").limit(10)
      : [await User.findOne({ email: identifier.toLowerCase() }).select("+password")].filter(Boolean);
    const exactCandidate = usernameLogin
      ? candidates.find((candidate) => candidate.username === identifier)
      : candidates[0];
    const orderedCandidates = exactCandidate
      ? [exactCandidate, ...candidates.filter((candidate) => candidate._id.toString() !== exactCandidate._id.toString())]
      : candidates;

    let user = null;
    let lockedMatch = null;
    for (const candidate of orderedCandidates) {
      if (await bcrypt.compare(password, candidate.password)) {
        if (candidate.isLocked()) lockedMatch = candidate;
        else {
          user = candidate;
          break;
        }
      }
    }

    if (!user) {
      if (lockedMatch || exactCandidate?.isLocked()) {
        const lockedUser = lockedMatch || exactCandidate;
        return res.status(423).json({ success: false, message: "Account is temporarily locked.", code: "ACCOUNT_LOCKED", lockUntil: lockedUser.lockUntil });
      }
      const failedCandidate = exactCandidate || (candidates.length === 1 ? candidates[0] : null);
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

    await User.findByIdAndUpdate(user._id, { loginAttempts: 0, lockUntil: null, isOnline: true });
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
