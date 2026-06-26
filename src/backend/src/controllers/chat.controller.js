const mongoose = require("../utils/mongoose");
const Conversation = require("../models/Conversation.model");
const Message = require("../models/Message.model");
const { conversationRoomId } = require("../models/Conversation.model");
const fileStorage = require("../utils/fileStorage.utils");

function validId(value) {
  return mongoose.Types.ObjectId.isValid(value);
}

async function requireMembership(conversationId, userId) {
  if (!validId(conversationId)) return null;
  return Conversation.findOne({ _id: conversationId, members: userId });
}

function readAtForUser(conversation, userId) {
  const receipt = (conversation.readBy || []).find((entry) => entry.userId?.toString() === userId);
  return receipt?.lastReadAt || conversation.createdAt || new Date(0);
}

function clearedAtForUser(conversation, userId) {
  const receipt = (conversation.clearedFor || []).find((entry) => entry.userId?.toString() === userId);
  return receipt?.clearedAt || null;
}

async function unreadCountForConversation(conversation, userId) {
  return Message.countDocuments({
    conversationId: conversation._id,
    senderId: { $ne: userId },
    createdAt: { $gt: readAtForUser(conversation, userId) },
  });
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

    const publicConversations = await Promise.all(conversations.map(async (conversation) => {
      const { archivedFor = [], deletedFor: _deletedFor, clearedFor: _clearedFor, readBy: _readBy, ...publicConversation } = conversation;
      return {
        ...publicConversation,
        roomId: publicConversation.roomId || conversationRoomId(publicConversation._id),
        archived: archivedFor.some((id) => id.toString() === req.userId),
        clearedAt: clearedAtForUser(conversation, req.userId),
        unreadCount: await unreadCountForConversation(conversation, req.userId),
      };
    }));

    return res.json({
      success: true,
      conversations: publicConversations,
    });
  } catch (error) {
    console.error("[getConversations]", error);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

exports.markConversationRead = async (req, res) => {
  try {
    const conversation = await requireMembership(req.params.conversationId, req.userId);
    if (!conversation) {
      return res.status(404).json({ success: false, message: "Conversation not found." });
    }
    const now = new Date();
    const existing = conversation.readBy.find((entry) => entry.userId.toString() === req.userId);
    if (existing) existing.lastReadAt = now;
    else conversation.readBy.push({ userId: req.userId, lastReadAt: now });
    await conversation.save();
    return res.json({ success: true, conversationId: conversation._id, readAt: now, unreadCount: 0 });
  } catch (error) {
    console.error("[markConversationRead]", error);
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

    const now = new Date();
    await Conversation.updateOne(
      { _id: conversation._id, "clearedFor.userId": req.userId },
      {
        $set: { "clearedFor.$.clearedAt": now },
        $addToSet: { deletedFor: req.userId },
        $pull: { archivedFor: req.userId },
      },
    );
    await Conversation.updateOne(
      { _id: conversation._id, "clearedFor.userId": { $ne: req.userId } },
      {
        $push: { clearedFor: { userId: req.userId, clearedAt: now } },
        $addToSet: { deletedFor: req.userId },
        $pull: { archivedFor: req.userId },
      },
    );
    return res.json({ success: true, conversationId: conversation._id, deleted: true, clearedAt: now });
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
      const clearedAt = clearedAtForUser(conversation, req.userId);
      if (clearedAt) query.createdAt = { $gt: clearedAt };
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
    const publicMessages = messages.reverse().map((message) => ({
      ...message,
      fileUrl: message.filePublicId ? fileStorage.publicFileUrl(req, message.filePublicId, message.fileUrl) : message.fileUrl,
    }));
    return res.json({ success: true, messages: publicMessages, nextCursor });
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
