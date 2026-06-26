const path = require("path");
const Conversation = require("../models/Conversation.model");
const Message = require("../models/Message.model");
const User = require("../models/User.model");
const { notifyConversationMembers } = require("../socket/chat.socket");
const { validateKycConversationMembers } = require("../utils/conversationSecurity.utils");
const { restoreConversationForMessageRecipients } = require("../utils/conversationVisibility.utils");
const fileStorage = require("../utils/fileStorage.utils");
const { validateEncryptedEnvelope } = require("../utils/encryptedEnvelope.utils");
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

    const conversation = await memberConversation(conversationId, req.userId);
    if (!conversation) return res.status(404).json({ success: false, message: "Conversation not found or access denied." });
    const kycValidation = await validateKycConversationMembers(conversation);
    if (!kycValidation.valid) {
      return res.status(kycValidation.status).json({ success: false, code: kycValidation.code, message: kycValidation.message });
    }
    const envelopeValidation = validateEncryptedEnvelope({ encryptedContent, signature, conversation, expectedKind: "file" });
    if (!envelopeValidation.valid) {
      return res.status(400).json({ success: false, code: envelopeValidation.code, message: envelopeValidation.message });
    }
    const sender = await User.findById(req.userId).select("publicKey blocklist");
    if (!sender?.publicKey || !await verifyEnvelopeSignature(encryptedContent, signature, sender.publicKey)) {
      return res.status(409).json({ success: false, code: "KEY_MISMATCH", message: "Device key does not match the account public key. Restore or synchronize the device key before uploading." });
    }
    if (conversation.type === "DIRECT" || conversation.type === "direct") {
      const receiverId = conversation.members.find((id) => id.toString() !== req.userId)?.toString();
      const receiver = receiverId ? await User.findById(receiverId).select("blocklist") : null;
      if (receiverId && sender.blocklist?.some((id) => id.toString() === receiverId)) {
        return res.status(403).json({ success: false, code: "BLOCKED_BY_YOU", message: "Unblock this user before uploading a file." });
      }
      if (receiver?.blocklist?.some((id) => id.toString() === req.userId)) {
        return res.status(403).json({ success: false, code: "BLOCKED_BY_RECEIVER", message: "The recipient has blocked this sender." });
      }
    }

    const uploaded = await fileStorage.uploadEncryptedFile(req.file.buffer, "application/octet-stream");
    const originalName = safeName(req.body.originalName);
    const originalMime = typeof req.body.originalMime === "string" ? req.body.originalMime.slice(0, 127) : "application/octet-stream";
    const fileUrl = fileStorage.publicFileUrl(req, uploaded.publicId, uploaded.url);
    const message = await Message.create({
      conversationId,
      senderId: req.userId,
      encryptedContent,
      signature,
      senderPublicKey: sender.publicKey,
      clientMessageId: req.body.tempId || null,
      msgType: "FILE",
      status: "SENT",
      fileUrl,
      fileName: originalName,
      fileMime: originalMime,
      fileSizeBytes: req.file.size,
      filePublicId: uploaded.publicId,
    });
    await restoreConversationForMessageRecipients(conversation, req.userId, message._id);
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
        senderId: req.userId,
        msgType: message.msgType,
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
      .select("encryptedContent signature senderPublicKey fileUrl fileName fileMime fileSizeBytes filePublicId senderId timestamp createdAt")
      .lean();
    const nextCursor = files.length === limit ? files[files.length - 1]._id : null;
    return res.json({
      success: true,
      files: files.reverse().map((file) => ({
        ...file,
        fileUrl: file.filePublicId ? fileStorage.publicFileUrl(req, file.filePublicId, file.fileUrl) : file.fileUrl,
      })),
      nextCursor,
    });
  } catch (error) {
    console.error("[getFilesByConversation]", error);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

exports.getEncryptedFileBlob = async (req, res) => {
  try {
    const buffer = await fileStorage.readSignedEncryptedFile(req.params.token);
    res.setHeader("Cache-Control", "private, max-age=3600");
    res.setHeader("Content-Type", "application/octet-stream");
    return res.send(buffer);
  } catch (error) {
    const status = error.status || (error.name === "TokenExpiredError" || error.name === "JsonWebTokenError" ? 403 : 500);
    if (status >= 500) console.error("[getEncryptedFileBlob]", error);
    return res.status(status).json({ success: false, message: status === 403 ? "Encrypted file link is invalid or expired." : "Encrypted file not found." });
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
