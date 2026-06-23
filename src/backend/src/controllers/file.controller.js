const path = require("path");
const Conversation = require("../models/Conversation.model");
const Message = require("../models/Message.model");
const User = require("../models/User.model");
const { notifyConversationMembers } = require("../socket/chat.socket");
const { uploadToCloudinary } = require("../utils/cloudinary.utils");
const { verifyEnvelopeSignature } = require("../utils/signature.utils");

async function memberConversation(conversationId, userId) {
  return Conversation.findOne({ _id: conversationId, members: userId });
}

function safeName(value) {
  return path.basename(typeof value === "string" ? value : "encrypted-file").slice(0, 255);
}

exports.uploadFile = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: "Encrypted file blob is required." });
    const { conversationId, encryptedContent, signature } = req.body;
    if (!conversationId || typeof encryptedContent !== "string" || !encryptedContent || typeof signature !== "string" || !signature) {
      return res.status(400).json({ success: false, message: "conversationId, encryptedContent and signature are required." });
    }
    if (encryptedContent.length > 100000 || signature.length > 16384) {
      return res.status(413).json({ success: false, message: "Encrypted file envelope is too large." });
    }

    let envelope;
    try {
      envelope = JSON.parse(encryptedContent);
    } catch (_error) {
      return res.status(400).json({ success: false, message: "Invalid encrypted file envelope." });
    }
    if (envelope?.v !== 1 || envelope?.kind !== "file" || !envelope?.iv || !envelope?.keys) {
      return res.status(400).json({ success: false, message: "Invalid encrypted file envelope." });
    }

    const conversation = await memberConversation(conversationId, req.userId);
    if (!conversation) return res.status(404).json({ success: false, message: "Conversation not found or access denied." });
    if (conversation.members.some((memberId) => !envelope.keys[memberId.toString()])) {
      return res.status(400).json({ success: false, message: "Encrypted file must include a wrapped key for every member." });
    }
    const sender = await User.findById(req.userId).select("publicKey");
    if (!sender?.publicKey || !await verifyEnvelopeSignature(encryptedContent, signature, sender.publicKey)) {
      return res.status(409).json({ success: false, code: "KEY_MISMATCH", message: "Device key does not match the account public key. Restore or synchronize the device key before uploading." });
    }

    const uploaded = await uploadToCloudinary(req.file.buffer, "application/octet-stream", "securechat/messages");
    const originalName = safeName(req.body.originalName);
    const originalMime = typeof req.body.originalMime === "string" ? req.body.originalMime.slice(0, 127) : "application/octet-stream";
    const message = await Message.create({
      conversationId,
      senderId: req.userId,
      encryptedContent,
      signature,
      senderPublicKey: sender.publicKey,
      clientMessageId: req.body.tempId || null,
      msgType: "FILE",
      status: "SENT",
      fileUrl: uploaded.url,
      fileName: originalName,
      fileMime: originalMime,
      fileSizeBytes: req.file.size,
      filePublicId: uploaded.publicId,
    });
    await Conversation.findByIdAndUpdate(conversationId, { lastMessage: message._id });
    const io = req.app.get("io");
    io?.to(conversationId).emit("new_message", {
      _id: message._id,
      conversationId,
      senderId: req.userId,
      encryptedContent,
      signature,
      senderPublicKey: sender.publicKey,
      msgType: "FILE",
      status: message.status,
      fileUrl: message.fileUrl,
      fileName: message.fileName,
      fileMime: message.fileMime,
      fileSizeBytes: message.fileSizeBytes,
      timestamp: message.timestamp,
      createdAt: message.createdAt,
    });
    if (io) {
      notifyConversationMembers(io, conversation, {
        conversationId,
        lastMessageId: message._id,
        updatedAt: message.createdAt,
      });
    }
    return res.status(201).json({
      success: true,
      message: {
        _id: message._id,
        conversationId,
        senderId: req.userId,
        encryptedContent,
        signature,
        senderPublicKey: sender.publicKey,
        msgType: "FILE",
        status: message.status,
        fileUrl: message.fileUrl,
        fileName: message.fileName,
        fileMime: message.fileMime,
        fileSizeBytes: message.fileSizeBytes,
        timestamp: message.timestamp,
        createdAt: message.createdAt,
      },
    });
  } catch (error) {
    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({ success: false, message: `File exceeds ${process.env.MAX_FILE_SIZE_MB || 10} MB.` });
    }
    if (error.message?.includes("not supported")) return res.status(400).json({ success: false, message: error.message });
    console.error("[uploadFile]", error);
    return res.status(500).json({ success: false, message: "Unable to upload encrypted file." });
  }
};

exports.getFilesByConversation = async (req, res) => {
  try {
    const conversation = await memberConversation(req.params.conversationId, req.userId);
    if (!conversation) return res.status(404).json({ success: false, message: "Conversation not found or access denied." });

    const requestedLimit = Number.parseInt(req.query.limit, 10);
    const limit = Number.isInteger(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 100) : 20;
    const query = { conversationId: conversation._id, msgType: "FILE" };
    if (req.query.type === "image") query.fileMime = { $regex: /^(image|video)\// };
    if (req.query.type === "file") query.fileMime = { $not: /^(image|video)\// };
    if (req.query.before) query._id = { $lt: req.query.before };

    const files = await Message.find(query)
      .sort({ _id: -1 })
      .limit(limit)
      .populate("senderId", "username displayName avatarUrl kycStatus publicKey")
      .select("encryptedContent signature senderPublicKey fileUrl fileName fileMime fileSizeBytes senderId timestamp createdAt")
      .lean();
    const nextCursor = files.length === limit ? files[files.length - 1]._id : null;
    return res.json({ success: true, files: files.reverse(), nextCursor });
  } catch (error) {
    console.error("[getFilesByConversation]", error);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

exports.jumpToMessage = async (req, res) => {
  try {
    const conversation = await memberConversation(req.params.conversationId, req.userId);
    if (!conversation) return res.status(404).json({ success: false, message: "Conversation not found or access denied." });
    const message = await Message.findOne({ _id: req.params.messageId, conversationId: conversation._id, msgType: "FILE" })
      .select("_id timestamp createdAt senderId fileName fileMime")
      .lean();
    if (!message) return res.status(404).json({ success: false, message: "File message not found." });
    return res.json({ success: true, ...message, messageId: message._id });
  } catch (error) {
    console.error("[jumpToMessage]", error);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};
