const jwt = require("jsonwebtoken");
const Conversation = require("../models/Conversation.model");
const Message = require("../models/Message.model");
const PrivacyDelivery = require("../models/PrivacyDelivery.model");
const User = require("../models/User.model");
const { validateKycConversationMembers } = require("../utils/conversationSecurity.utils");
const { MAX_ENCRYPTED_MESSAGE_CHARS, MAX_SIGNATURE_CHARS, validateEncryptedEnvelope } = require("../utils/encryptedEnvelope.utils");
const { verifyEnvelopeSignature } = require("../utils/signature.utils");

const onlineUsers = new Map();
const pendingPrivacy = new Map();

function bearerToken(socket) {
  const authToken = socket.handshake.auth?.token;
  const header = socket.handshake.headers?.authorization;
  if (authToken) return authToken;
  return typeof header === "string" && header.startsWith("Bearer ") ? header.slice(7) : null;
}

function addOnlineSocket(userId, socketId) {
  const sockets = onlineUsers.get(userId) || new Set();
  sockets.add(socketId);
  onlineUsers.set(userId, sockets);
}

function removeOnlineSocket(userId, socketId) {
  const sockets = onlineUsers.get(userId);
  if (!sockets) return true;
  sockets.delete(socketId);
  if (sockets.size) return false;
  onlineUsers.delete(userId);
  return true;
}

async function ensureConversationRoom(socket, joinedConversations, conversationId) {
  const roomId = String(conversationId);
  if (!joinedConversations.has(roomId)) {
    await socket.join(roomId);
    joinedConversations.add(roomId);
  }
  return roomId;
}

function notifyConversationMembers(io, conversation, payload) {
  for (const memberId of conversation.members || []) {
    io.to(`user:${memberId.toString()}`).emit("conversation_updated", payload);
  }
}

function emitValidationError(emitError, event, validation, tempId) {
  emitError(event, validation.code, validation.message, { tempId });
}

function privateMessagePayload(delivery) {
  return {
    _id: delivery.messageId?.toString(),
    tempId: delivery.tempId,
    conversationId: delivery.conversationId.toString(),
    senderId: delivery.senderId.toString(),
    encryptedContent: delivery.encryptedContent,
    signature: delivery.signature,
    senderPublicKey: delivery.senderPublicKey,
    createdAt: delivery.createdAt,
    queued: true,
  };
}

async function queuePrivateDeliveries(conversation, senderId, messageData) {
  const deliveries = [];
  for (const memberId of conversation.members || []) {
    const recipientId = memberId.toString();
    if (recipientId === senderId) continue;
    deliveries.push(await PrivacyDelivery.findOneAndUpdate(
      { recipientId, tempId: messageData.tempId },
      {
        $setOnInsert: {
          conversationId: messageData.conversationId,
          recipientId,
          senderId,
          messageId: messageData._id,
          tempId: messageData.tempId,
          encryptedContent: messageData.encryptedContent,
          signature: messageData.signature,
          senderPublicKey: messageData.senderPublicKey,
        },
      },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
    ));
  }
  return deliveries;
}

async function deliverQueuedPrivateMessages(socket, conversationId) {
  const deliveries = await PrivacyDelivery.find({
    recipientId: socket.userId,
    conversationId,
    expiresAt: { $gt: new Date() },
  })
    .sort({ createdAt: 1 })
    .limit(100)
    .lean();
  for (const delivery of deliveries) {
    socket.emit("new_private_message", privateMessagePayload(delivery));
  }
  return deliveries.length;
}

module.exports = function registerChatSocket(io) {
  io.use((socket, next) => {
    try {
      const payload = jwt.verify(bearerToken(socket), process.env.JWT_SECRET);
      socket.userId = payload.userId;
      next();
    } catch (_error) {
      const error = new Error("not authorized");
      error.data = { code: "SOCKET_UNAUTHORIZED" };
      next(error);
    }
  });

  io.on("connection", async (socket) => {
    const joinedConversations = new Set();
    addOnlineSocket(socket.userId, socket.id);
    await socket.join(`user:${socket.userId}`);
    await User.findByIdAndUpdate(socket.userId, { isOnline: true }).catch((error) => {
      console.error("[socket online]", error);
    });
    socket.broadcast.emit("user_status", { userId: socket.userId, isOnline: true });

    const emitError = (event, code, message, extra = {}) => {
      socket.emit("socket_error", { event, code, message, ...extra });
    };

    const joinConversation = async ({ conversationId } = {}, acknowledge) => {
      if (!conversationId) {
        emitError("join_conversation", "MISSING_CONVERSATION_ID", "conversationId is required.");
        return acknowledge?.({ success: false });
      }
      try {
        const conversation = await Conversation.findOne({ _id: conversationId, members: socket.userId });
        if (!conversation) {
          emitError("join_conversation", "NOT_A_MEMBER", "Conversation not found or access denied.");
          return acknowledge?.({ success: false });
        }
        await ensureConversationRoom(socket, joinedConversations, conversationId);
        const queuedCount = ["PRIVACY", "Privacy"].includes(conversation.mode)
          ? await deliverQueuedPrivateMessages(socket, conversation._id)
          : 0;
        return acknowledge?.({ success: true, queuedPrivateMessages: queuedCount });
      } catch (error) {
        console.error("[join_conversation]", error);
        emitError("join_conversation", "SERVER_ERROR", "Unable to join conversation.");
        return acknowledge?.({ success: false });
      }
    };

    const leaveConversation = ({ conversationId } = {}) => {
      if (!conversationId) return;
      joinedConversations.delete(conversationId);
      socket.leave(conversationId);
    };

    socket.on("join", joinConversation);
    socket.on("join_conversation", joinConversation);
    socket.on("leave", leaveConversation);
    socket.on("leave_conversation", leaveConversation);
    socket.on("user_online", () => socket.emit("user_status", { userId: socket.userId, isOnline: true }));

    socket.on("send_message", async (data = {}) => {
      const { conversationId, encryptedContent, signature, msgType, replyTo, tempId } = data;
      if (!conversationId || !encryptedContent || typeof signature !== "string" || !signature) {
        return emitError("send_message", "MISSING_REQUIRED_FIELDS", "conversationId, encryptedContent and signature are required.", { tempId });
      }
      if (typeof encryptedContent !== "string" || encryptedContent.length > MAX_ENCRYPTED_MESSAGE_CHARS) {
        return emitError("send_message", "MESSAGE_TOO_LARGE", "Encrypted message is too large.", { tempId });
      }
      if (signature.length > MAX_SIGNATURE_CHARS) return emitError("send_message", "SIGNATURE_TOO_LARGE", "Signature is too large.", { tempId });

      try {
        const conversation = await Conversation.findOne({ _id: conversationId, members: socket.userId });
        if (!conversation) {
          return emitError("send_message", "NOT_A_MEMBER", "Conversation not found or access denied.", { tempId });
        }
        if (conversation.mode === "PRIVACY" || conversation.mode === "Privacy") {
          return emitError("send_message", "USE_PRIVATE_EVENT", "Use send_private_message for privacy mode.", { tempId });
        }
        const kycValidation = await validateKycConversationMembers(conversation);
        if (!kycValidation.valid) {
          return emitError("send_message", kycValidation.code, kycValidation.message, { tempId });
        }
        const envelopeValidation = validateEncryptedEnvelope({ encryptedContent, signature, conversation, expectedKind: "text" });
        if (!envelopeValidation.valid) {
          return emitValidationError(emitError, "send_message", envelopeValidation, tempId);
        }

        const sender = await User.findById(socket.userId).select("publicKey blocklist");
        if (!sender?.publicKey || !await verifyEnvelopeSignature(encryptedContent, signature, sender.publicKey)) {
          return emitError("send_message", "KEY_MISMATCH", "Device key does not match the account public key. Restore or synchronize the device key before sending.", { tempId });
        }

        // A creator can send before the asynchronous join event finishes. Join here so
        // the accepted message is always echoed back to the sender's active workspace.
        await ensureConversationRoom(socket, joinedConversations, conversationId);

        if (conversation.type === "DIRECT" || conversation.type === "direct") {
          const receiverId = conversation.members.find((id) => id.toString() !== socket.userId)?.toString();
          const receiver = receiverId ? await User.findById(receiverId).select("blocklist") : null;
          if (receiverId && sender.blocklist?.some((id) => id.toString() === receiverId)) {
            return emitError("send_message", "BLOCKED_BY_YOU", "Unblock this user before sending a message.", { tempId });
          }
          if (receiver?.blocklist?.some((id) => id.toString() === socket.userId)) {
            return emitError("send_message", "BLOCKED_BY_RECEIVER", "The recipient has blocked this sender.", { tempId });
          }
        }

        const message = await Message.create({
          conversationId,
          senderId: socket.userId,
          encryptedContent,
          signature,
          senderPublicKey: sender.publicKey,
          clientMessageId: tempId || null,
          msgType: msgType || "TEXT",
          replyTo: replyTo || null,
          status: "SENT",
        });
        await Conversation.findByIdAndUpdate(conversationId, { lastMessage: message._id });

        const messageData = {
          _id: message._id,
          conversationId,
          senderId: socket.userId,
          encryptedContent: message.encryptedContent,
          signature: message.signature,
          senderPublicKey: message.senderPublicKey,
          msgType: message.msgType,
          status: message.status,
          replyTo: message.replyTo,
          timestamp: message.timestamp,
          createdAt: message.createdAt,
          tempId,
        };
        io.to(conversationId).emit("new_message", messageData);
        notifyConversationMembers(io, conversation, {
          conversationId,
          lastMessageId: message._id,
          senderId: socket.userId,
          msgType: message.msgType,
          updatedAt: message.createdAt,
        });

        const recipientOnline = conversation.members.some((id) => {
          const userId = id.toString();
          return userId !== socket.userId && onlineUsers.has(userId);
        });
        if (recipientOnline) {
          message.status = "DELIVERED";
          await message.save();
          io.to(conversationId).emit("message_status", { messageId: message._id, status: "DELIVERED" });
        }
      } catch (error) {
        if (error?.code === 11000) {
          return emitError("send_message", "DUPLICATE_MESSAGE", "This message was already accepted.", { tempId });
        }
        console.error("[send_message]", error);
        emitError("send_message", "SERVER_ERROR", "Unable to send message.", { tempId });
      }
    });

    socket.on("send_private_message", async (data = {}) => {
      const { conversationId, encryptedContent, signature, tempId } = data;
      if (!conversationId || !encryptedContent || typeof signature !== "string" || !signature || !tempId) {
        return emitError("send_private_message", "MISSING_REQUIRED_FIELDS", "conversationId, encryptedContent, signature and tempId are required.", { tempId });
      }
      if (encryptedContent.length > MAX_ENCRYPTED_MESSAGE_CHARS || signature.length > MAX_SIGNATURE_CHARS) {
        return emitError("send_private_message", "MESSAGE_TOO_LARGE", "Encrypted message or signature is too large.", { tempId });
      }
      try {
        const conversation = await Conversation.findOne({ _id: conversationId, members: socket.userId });
        if (!conversation || !["PRIVACY", "Privacy"].includes(conversation.mode)) {
          return emitError("send_private_message", "INVALID_PRIVACY_CONVERSATION", "Privacy conversation not found or access denied.", { tempId });
        }
        const envelopeValidation = validateEncryptedEnvelope({ encryptedContent, signature, conversation, expectedKind: "text" });
        if (!envelopeValidation.valid) {
          return emitValidationError(emitError, "send_private_message", envelopeValidation, tempId);
        }
        const sender = await User.findById(socket.userId).select("publicKey blocklist");
        if (!sender?.publicKey || !await verifyEnvelopeSignature(encryptedContent, signature, sender.publicKey)) {
          return emitError("send_private_message", "KEY_MISMATCH", "Device key does not match the account public key. Restore or synchronize the device key before sending.", { tempId });
        }
        if (conversation.type === "DIRECT" || conversation.type === "direct") {
          const receiverId = conversation.members.find((id) => id.toString() !== socket.userId)?.toString();
          const receiver = receiverId ? await User.findById(receiverId).select("blocklist") : null;
          if (receiverId && sender.blocklist?.some((id) => id.toString() === receiverId)) {
            return emitError("send_private_message", "BLOCKED_BY_YOU", "Unblock this user before sending a message.", { tempId });
          }
          if (receiver?.blocklist?.some((id) => id.toString() === socket.userId)) {
            return emitError("send_private_message", "BLOCKED_BY_RECEIVER", "The recipient has blocked this sender.", { tempId });
          }
        }
        const createdAt = new Date().toISOString();
        const message = await Message.create({
          conversationId,
          senderId: socket.userId,
          encryptedContent,
          signature,
          senderPublicKey: sender.publicKey,
          clientMessageId: tempId,
          msgType: "TEXT",
          status: "SENT",
        });
        await Conversation.findByIdAndUpdate(conversationId, { lastMessage: message._id });
        const messageData = {
          _id: message._id,
          tempId,
          conversationId,
          senderId: socket.userId,
          encryptedContent,
          signature,
          senderPublicKey: sender.publicKey,
          msgType: message.msgType,
          status: message.status,
          timestamp: message.timestamp,
          createdAt: message.createdAt || createdAt,
        };
        const deliveries = await queuePrivateDeliveries(conversation, socket.userId, messageData);
        for (const memberId of conversation.members) {
          const recipientId = memberId.toString();
          if (recipientId !== socket.userId) io.to(`user:${recipientId}`).emit("new_private_message", messageData);
        }
        pendingPrivacy.set(tempId, {
          conversationId,
          participants: new Set([socket.userId]),
          expectedRecipients: new Set(deliveries.map((delivery) => delivery.recipientId.toString())),
          timer: setTimeout(() => pendingPrivacy.delete(tempId), 30000),
        });
        notifyConversationMembers(io, conversation, {
          conversationId,
          lastMessageId: message._id,
          senderId: socket.userId,
          msgType: message.msgType,
          updatedAt: message.createdAt,
        });
        socket.emit("private_message_sent", { tempId, messageId: message._id, conversationId, createdAt: message.createdAt });
      } catch (error) {
        if (error?.code === 11000) {
          return emitError("send_private_message", "DUPLICATE_MESSAGE", "This message was already accepted.", { tempId });
        }
        console.error("[send_private_message]", error);
        emitError("send_private_message", "SERVER_ERROR", "Unable to relay privacy message.", { tempId });
      }
    });

    socket.on("ack_private_message", async ({ tempId } = {}) => {
      if (tempId) {
        await PrivacyDelivery.deleteOne({ recipientId: socket.userId, tempId }).catch((error) => {
          console.error("[ack_private_message delete]", error);
        });
      }
      const pending = pendingPrivacy.get(tempId);
      if (!pending || !joinedConversations.has(pending.conversationId)) return;
      pending.participants.add(socket.userId);
      const allRecipientsAcked = [...pending.expectedRecipients].every((recipientId) => pending.participants.has(recipientId));
      if (allRecipientsAcked) {
        clearTimeout(pending.timer);
        pendingPrivacy.delete(tempId);
      }
    });

    socket.on("mark_seen", async ({ messageId, conversationId } = {}) => {
      try {
        const conversation = await Conversation.exists({ _id: conversationId, members: socket.userId });
        if (!conversation) return emitError("mark_seen", "NOT_A_MEMBER", "Conversation access denied.");
        const message = await Message.findOneAndUpdate(
          { _id: messageId, conversationId },
          { status: "SEEN" },
          { returnDocument: "after" },
        );
        if (!message) return emitError("mark_seen", "MESSAGE_NOT_FOUND", "Message not found.");
        io.to(conversationId).emit("message_status", { messageId, status: "SEEN", seenBy: socket.userId });
      } catch (error) {
        console.error("[mark_seen]", error);
        emitError("mark_seen", "SERVER_ERROR", "Unable to update message status.");
      }
    });

    socket.on("typing", ({ conversationId } = {}) => {
      if (joinedConversations.has(conversationId)) socket.to(conversationId).emit("user_typing", { userId: socket.userId, conversationId });
    });
    socket.on("stop_typing", ({ conversationId } = {}) => {
      if (joinedConversations.has(conversationId)) socket.to(conversationId).emit("user_stop_typing", { userId: socket.userId, conversationId });
    });

    socket.on("get_missed_messages", async ({ conversationId, since } = {}) => {
      try {
        const sinceDate = new Date(since);
        const conversation = await Conversation.exists({ _id: conversationId, members: socket.userId });
        if (!conversation || Number.isNaN(sinceDate.getTime())) {
          return emitError("get_missed_messages", "INVALID_REQUEST", "Valid conversationId and since are required.");
        }
        const messages = await Message.find({ conversationId, createdAt: { $gt: sinceDate } })
          .sort({ createdAt: 1 })
          .limit(100)
          .populate("senderId", "username displayName avatarUrl kycStatus publicKey")
          .lean();
        socket.emit("missed_messages", { conversationId, messages, count: messages.length });
      } catch (error) {
        console.error("[get_missed_messages]", error);
        emitError("get_missed_messages", "SERVER_ERROR", "Unable to load missed messages.");
      }
    });

    socket.on("disconnect", async (reason) => {
      if (!removeOnlineSocket(socket.userId, socket.id)) return;
      const lastSeen = new Date();
      await User.findByIdAndUpdate(socket.userId, { isOnline: false, lastSeen }).catch((error) => {
        console.error("[socket disconnect]", error);
      });
      socket.broadcast.emit("user_status", { userId: socket.userId, isOnline: false, lastSeen, reason });
    });
  });
};

module.exports.ensureConversationRoom = ensureConversationRoom;
module.exports.deliverQueuedPrivateMessages = deliverQueuedPrivateMessages;
module.exports.notifyConversationMembers = notifyConversationMembers;
module.exports.queuePrivateDeliveries = queuePrivateDeliveries;
