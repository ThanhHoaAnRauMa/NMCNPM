const mongoose = require("../utils/mongoose");
const Conversation = require("../models/Conversation.model");
const User = require("../models/User.model");

function validId(value) {
  return mongoose.Types.ObjectId.isValid(value);
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

exports.uploadPublicKey = async (req, res) => {
  try {
    const publicKey = typeof req.body.publicKey === "string" ? req.body.publicKey.trim() : "";
    if (!publicKey || publicKey.length > 16384) {
      return res.status(400).json({ success: false, message: "A valid public key is required." });
    }
    await User.findByIdAndUpdate(req.userId, { publicKey }, { runValidators: true });
    const io = req.app.get("io");
    if (io) {
      const participantIds = await Conversation.distinct("members", { members: req.userId });
      for (const participantId of participantIds) {
        io.to(`user:${participantId}`).emit("user_key_updated", { userId: req.userId });
      }
    }
    return res.json({ success: true, message: "Public key updated." });
  } catch (error) {
    console.error("[uploadPublicKey]", error);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

exports.getPublicKey = async (req, res) => {
  try {
    if (!validId(req.params.id)) return res.status(400).json({ success: false, message: "Invalid user id." });
    const user = await User.findById(req.params.id).select("publicKey username displayName").lean();
    if (!user) return res.status(404).json({ success: false, message: "User not found." });
    if (!user.publicKey) return res.status(404).json({ success: false, message: "User has no public key." });
    return res.json({ success: true, userId: user._id, username: user.username, displayName: user.displayName, publicKey: user.publicKey });
  } catch (error) {
    console.error("[getPublicKey]", error);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

exports.blockUser = async (req, res) => {
  try {
    if (!validId(req.params.id) || req.params.id === req.userId) {
      return res.status(400).json({ success: false, message: "Invalid user to block." });
    }
    const target = await User.findById(req.params.id).select("username").lean();
    if (!target) return res.status(404).json({ success: false, message: "User not found." });
    await User.findByIdAndUpdate(req.userId, { $addToSet: { blocklist: target._id } });
    return res.json({ success: true, message: `${target.username} was blocked.` });
  } catch (error) {
    console.error("[blockUser]", error);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

exports.unblockUser = async (req, res) => {
  try {
    if (!validId(req.params.id)) return res.status(400).json({ success: false, message: "Invalid user id." });
    await User.findByIdAndUpdate(req.userId, { $pull: { blocklist: req.params.id } });
    return res.json({ success: true, message: "User was unblocked." });
  } catch (error) {
    console.error("[unblockUser]", error);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const updates = {};
    if (typeof req.body.displayName === "string") updates.displayName = req.body.displayName.trim();
    if (typeof req.body.avatarUrl === "string") updates.avatarUrl = req.body.avatarUrl.trim() || null;
    if (!Object.keys(updates).length) {
      return res.status(400).json({ success: false, message: "No supported profile fields supplied." });
    }
    const user = await User.findByIdAndUpdate(req.userId, updates, { returnDocument: "after", runValidators: true })
      .select("-password -loginAttempts -lockUntil -blocklist")
      .lean();
    return res.json({ success: true, message: "Profile updated.", user: { ...user, id: user._id } });
  } catch (error) {
    console.error("[updateProfile]", error);
    return res.status(error.name === "ValidationError" ? 400 : 500).json({ success: false, message: error.name === "ValidationError" ? "Invalid profile data." : "Internal server error." });
  }
};

exports.getMyProfile = async (req, res) => {
  try {
    const user = await User.findById(req.userId).select("-password -loginAttempts -lockUntil -blocklist").lean();
    if (!user) return res.status(404).json({ success: false, message: "User not found." });
    return res.json({ success: true, user: { ...user, id: user._id } });
  } catch (error) {
    console.error("[getMyProfile]", error);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

exports.searchUsers = async (req, res) => {
  try {
    const query = typeof req.query.q === "string" ? req.query.q.trim() : "";
    if (query.length < 2 || query.length > 80) {
      return res.status(400).json({ success: false, message: "Search query must contain 2 to 80 characters." });
    }
    const regex = new RegExp(escapeRegex(query), "i");
    const users = await User.find({
      _id: { $ne: req.userId },
      $or: [{ username: regex }, { email: regex }, { displayName: regex }],
    })
      .select("username displayName avatarUrl kycStatus isOnline lastSeen")
      .limit(10)
      .lean();
    return res.json({ success: true, users, count: users.length });
  } catch (error) {
    console.error("[searchUsers]", error);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

exports.startDirectConversation = async (req, res) => {
  try {
    const otherId = req.params.id;
    if (!validId(otherId) || otherId === req.userId) {
      return res.status(400).json({ success: false, message: "Invalid conversation participant." });
    }
    const otherUser = await User.findById(otherId).select("username displayName avatarUrl kycStatus publicKey blocklist");
    if (!otherUser) return res.status(404).json({ success: false, message: "User not found." });
    if (otherUser.blocklist.some((id) => id.toString() === req.userId)) {
      return res.status(403).json({ success: false, message: "This user cannot be contacted." });
    }

    let conversation = await Conversation.findOne({ type: { $in: ["DIRECT", "direct"] }, members: { $all: [req.userId, otherId], $size: 2 } });
    let isNew = false;
    if (!conversation) {
      const mode = req.body.mode === "PRIVACY" ? "PRIVACY" : "KYC";
      conversation = await Conversation.create({ type: "DIRECT", mode, members: [req.userId, otherId] });
      isNew = true;
    }
    const publicOtherUser = otherUser.toObject();
    delete publicOtherUser.blocklist;
    return res.status(isNew ? 201 : 200).json({ success: true, conversationId: conversation._id, conversation, isNew, otherUser: publicOtherUser });
  } catch (error) {
    console.error("[startDirectConversation]", error);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};
