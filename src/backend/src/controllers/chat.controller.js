const mongoose = require("../utils/mongoose");
const Conversation = require("../models/Conversation.model");
const Message = require("../models/Message.model");

function validId(value) {
  return mongoose.Types.ObjectId.isValid(value);
}

async function requireMembership(conversationId, userId) {
  if (!validId(conversationId)) return null;
  return Conversation.findOne({ _id: conversationId, members: userId });
}

exports.getConversations = async (req, res) => {
  try {
    const includeArchived = req.query.includeArchived === "true";
    const query = {
      members: req.userId,
      deletedFor: { $ne: req.userId },
    };
    if (!includeArchived) query.archivedFor = { $ne: req.userId };

    const conversations = await Conversation.find(query)
      .populate("members", "username displayName avatarUrl kycStatus isOnline lastSeen publicKey")
      .populate("lastMessage")
      .sort({ updatedAt: -1 })
      .lean();

    return res.json({
      success: true,
      conversations: conversations.map((conversation) => {
        const { archivedFor = [], deletedFor: _deletedFor, ...publicConversation } = conversation;
        return {
          ...publicConversation,
          archived: archivedFor.some((id) => id.toString() === req.userId),
        };
      }),
    });
  } catch (error) {
    console.error("[getConversations]", error);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

exports.setConversationArchive = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const archived = req.body?.archived !== false;
    if (!validId(conversationId)) {
      return res.status(400).json({ success: false, message: "Invalid conversation id." });
    }
    const conversation = await Conversation.findOne({ _id: conversationId, members: req.userId, deletedFor: { $ne: req.userId } });
    if (!conversation) {
      return res.status(404).json({ success: false, message: "Conversation not found." });
    }

    const update = archived
      ? { $addToSet: { archivedFor: req.userId } }
      : { $pull: { archivedFor: req.userId } };
    await Conversation.updateOne({ _id: conversation._id }, update);
    return res.json({ success: true, conversationId: conversation._id, archived });
  } catch (error) {
    console.error("[setConversationArchive]", error);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

exports.deleteConversationForUser = async (req, res) => {
  try {
    const { conversationId } = req.params;
    if (!validId(conversationId)) {
      return res.status(400).json({ success: false, message: "Invalid conversation id." });
    }
    const conversation = await Conversation.findOne({ _id: conversationId, members: req.userId });
    if (!conversation) {
      return res.status(404).json({ success: false, message: "Conversation not found." });
    }

    await Conversation.updateOne(
      { _id: conversation._id },
      { $addToSet: { deletedFor: req.userId }, $pull: { archivedFor: req.userId } },
    );
    return res.json({ success: true, conversationId: conversation._id, deleted: true });
  } catch (error) {
    console.error("[deleteConversationForUser]", error);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

exports.getMessages = async (req, res) => {
  try {
    const conversation = await requireMembership(req.params.conversationId, req.userId);
    if (!conversation) {
      return res.status(404).json({ success: false, message: "Conversation not found." });
    }

    const requestedLimit = Number.parseInt(req.query.limit, 10);
    const limit = Number.isInteger(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 100) : 30;
    const query = { conversationId: conversation._id };
    if (req.query.includeHidden !== "true") {
      query.$or = [{ deletedForSender: false }, { deletedForSender: { $exists: false } }, { senderId: { $ne: req.userId } }];
    }

    if (req.query.before) {
      if (!validId(req.query.before)) {
        return res.status(400).json({ success: false, message: "Invalid cursor." });
      }
      query._id = { $lt: req.query.before };
    }

    const messages = await Message.find(query)
      .sort({ _id: -1 })
      .limit(limit)
      .populate("senderId", "username displayName avatarUrl kycStatus publicKey")
      .lean();

    const nextCursor = messages.length === limit ? messages[messages.length - 1]._id : null;
    return res.json({ success: true, messages: messages.reverse(), nextCursor });
  } catch (error) {
    console.error("[getMessages]", error);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

exports.softDeleteMessage = async (req, res) => {
  try {
    if (!validId(req.params.messageId)) {
      return res.status(400).json({ success: false, message: "Invalid message id." });
    }
    const message = await Message.findById(req.params.messageId);
    if (!message) {
      return res.status(404).json({ success: false, message: "Message not found." });
    }
    if (message.senderId.toString() !== req.userId) {
      return res.status(403).json({ success: false, message: "Only the sender can hide this message." });
    }

    message.deletedForSender = true;
    await message.save();
    return res.json({ success: true, message: "Message hidden for the sender only.", messageId: message._id });
  } catch (error) {
    console.error("[softDeleteMessage]", error);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

exports.requireMembership = requireMembership;
