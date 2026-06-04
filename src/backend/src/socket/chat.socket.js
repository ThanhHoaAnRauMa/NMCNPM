const Message = require("../models/Message.model");
const Conversation = require("../models/Conversation.model");
const User = require("../models/User.model");

const onlineUsers = new Map();

const offlineQueue = new Map();

const pendingPrivacy = new Map();

function queueForOfflineUser(userId, messageData) {
  if (!offlineQueue.has(userId)) {
    offlineQueue.set(userId, []);
  }
  const queue = offlineQueue.get(userId);
  queue.push(messageData);

  if (queue.length > 100) {
    queue.shift();
  }
}

module.exports = (io) => {
  io.on("error", (err) => {
    console.error("[Socket.io global error]", err.message);
  });

  io.on("connection", (socket) => {
    console.log(`🔌 Socket connected: ${socket.id}`);

    const emitError = (event, code, message, extra = {}) => {
      socket.emit("socket_error", {
        event,
        code,
        message,
        ...extra,
      });
    };

    socket.on("user_online", async ({ userId }) => {
      try {
        onlineUsers.set(userId, socket.id);
        socket.userId = userId;

        await User.findByIdAndUpdate(userId, { isOnline: true });
        socket.broadcast.emit("user_status", { userId, isOnline: true });

        const queue = offlineQueue.get(userId);
        if (queue && queue.length > 0) {
          console.log(
            `📬 Delivering ${queue.length} queued messages to ${userId}`,
          );
          queue.forEach((msg) => {
            socket.emit("new_message", { ...msg, fromQueue: true });
          });
          offlineQueue.delete(userId);
        }

        console.log(`👤 User online: ${userId}`);
      } catch (err) {
        console.error("[user_online error]", err);
      }
    });

    socket.on("join_conversation", ({ conversationId }) => {
      if (!conversationId) {
        emitError(
          "join_conversation",
          "MISSING_CONVERSATION_ID",
          "Thiếu conversationId",
        );
        return;
      }
      socket.join(conversationId);
    });

    socket.on("leave_conversation", ({ conversationId }) => {
      socket.leave(conversationId);
    });

    socket.on("send_message", async (data) => {
      const {
        conversationId,
        encryptedContent,
        signature,
        msgType,
        replyTo,
        tempId,
      } = data;

      if (!conversationId || !encryptedContent || !signature) {
        emitError(
          "send_message",
          "MISSING_REQUIRED_FIELDS",
          "Thiếu conversationId, encryptedContent hoặc signature",
          { tempId },
        );
        return;
      }

      try {
        const senderId = socket.userId;

        if (!senderId) {
          emitError(
            "send_message",
            "NOT_AUTHENTICATED",
            "Bạn chưa đăng nhập. Hãy emit user_online trước.",
            { tempId },
          );
          return;
        }

        const conv = await Conversation.findById(conversationId);
        if (!conv) {
          emitError(
            "send_message",
            "CONVERSATION_NOT_FOUND",
            "Conversation không tồn tại.",
            { tempId },
          );
          return;
        }

        const isMember = conv.members.some((m) => m.toString() === senderId);
        if (!isMember) {
          emitError(
            "send_message",
            "NOT_A_MEMBER",
            "Bạn không phải thành viên của conversation này.",
            { tempId },
          );
          return;
        }

        if (conv.mode === "PRIVACY") {
          emitError(
            "send_message",
            "USE_PRIVATE_EVENT",
            "Conversation này ở Privacy Mode. Dùng event send_private_message.",
            { tempId },
          );
          return;
        }

        const message = await Message.create({
          conversationId,
          senderId,
          encryptedContent,
          signature,
          msgType: msgType || "TEXT",
          replyTo: replyTo || null,
          status: "SENT",
        });

        await Conversation.findByIdAndUpdate(conversationId, {
          lastMessage: message._id,
        });

        const messageData = {
          _id: message._id,
          conversationId,
          senderId,
          encryptedContent: message.encryptedContent,
          signature: message.signature,
          msgType: message.msgType,
          status: "SENT",
          replyTo: message.replyTo,
          createdAt: message.createdAt,
          tempId,
        };

        io.to(conversationId).emit("new_message", messageData);

        for (const memberId of conv.members) {
          const memberIdStr = memberId.toString();
          if (memberIdStr === senderId) continue;

          const receiverSocketId = onlineUsers.get(memberIdStr);
          if (receiverSocketId) {
            await Message.findByIdAndUpdate(message._id, {
              status: "DELIVERED",
            });
            io.to(conversationId).emit("message_status", {
              messageId: message._id,
              status: "DELIVERED",
            });
          } else {
            queueForOfflineUser(memberIdStr, messageData);
            console.log(`📭 Queued message for offline user: ${memberIdStr}`);
          }
        }
      } catch (err) {
        console.error("[send_message error]", err);
        emitError(
          "send_message",
          "SERVER_ERROR",
          "Lỗi server khi gửi tin nhắn.",
          { tempId },
        );
      }
    });

    socket.on("send_private_message", async (data) => {
      const { conversationId, encryptedContent, signature, tempId } = data;

      if (!conversationId || !encryptedContent || !signature) {
        emitError(
          "send_private_message",
          "MISSING_REQUIRED_FIELDS",
          "Thiếu conversationId, encryptedContent hoặc signature.",
          { tempId },
        );
        return;
      }

      const senderId = socket.userId;

      socket.to(conversationId).emit("new_private_message", {
        tempId,
        conversationId,
        senderId,
        encryptedContent,
        signature,
        createdAt: new Date().toISOString(),
      });

      pendingPrivacy.set(tempId, {
        senderId,
        conversationId,
        ackedBy: new Set([senderId]),
        timer: setTimeout(() => {
          pendingPrivacy.delete(tempId);
        }, 30000),
      });

      socket.emit("private_message_sent", { tempId });
    });

    socket.on("ack_private_message", ({ tempId }) => {
      const pending = pendingPrivacy.get(tempId);
      if (!pending) return;
      pending.ackedBy.add(socket.userId);
      if (pending.ackedBy.size >= 2) {
        clearTimeout(pending.timer);
        pendingPrivacy.delete(tempId);
      }
    });

    socket.on("mark_seen", async ({ messageId, conversationId }) => {
      if (!messageId || !conversationId) {
        emitError(
          "mark_seen",
          "MISSING_FIELDS",
          "Thiếu messageId hoặc conversationId.",
        );
        return;
      }
      try {
        await Message.findByIdAndUpdate(messageId, { status: "SEEN" });
        io.to(conversationId).emit("message_status", {
          messageId,
          status: "SEEN",
          seenBy: socket.userId,
        });
      } catch (err) {
        console.error("[mark_seen error]", err);
        emitError("mark_seen", "SERVER_ERROR", "Lỗi khi cập nhật trạng thái.");
      }
    });

    socket.on("typing", ({ conversationId }) => {
      socket.to(conversationId).emit("user_typing", {
        userId: socket.userId,
        conversationId,
      });
    });

    socket.on("stop_typing", ({ conversationId }) => {
      socket.to(conversationId).emit("user_stop_typing", {
        userId: socket.userId,
        conversationId,
      });
    });

    socket.on("get_missed_messages", async ({ conversationId, since }) => {
      if (!conversationId || !since) {
        emitError(
          "get_missed_messages",
          "MISSING_FIELDS",
          "Thiếu conversationId hoặc since timestamp.",
        );
        return;
      }
      try {
        const missed = await Message.find({
          conversationId,
          createdAt: { $gt: new Date(since) },
        })
          .sort({ createdAt: 1 })
          .limit(50)
          .populate("senderId", "username avatarUrl");

        socket.emit("missed_messages", {
          conversationId,
          messages: missed,
          count: missed.length,
        });
      } catch (err) {
        console.error("[get_missed_messages error]", err);
        emitError(
          "get_missed_messages",
          "SERVER_ERROR",
          "Lỗi khi lấy tin nhắn bị miss.",
        );
      }
    });

    socket.on("disconnect", async (reason) => {
      console.log(`🔴 Socket disconnected: ${socket.id} — reason: ${reason}`);

      if (!socket.userId) return;

      onlineUsers.delete(socket.userId);

      try {
        await User.findByIdAndUpdate(socket.userId, {
          isOnline: false,
          lastSeen: new Date(),
        });

        socket.broadcast.emit("user_status", {
          userId: socket.userId,
          isOnline: false,
          lastSeen: new Date().toISOString(),
          reason,
        });
      } catch (err) {
        console.error("[disconnect handler error]", err);
      }
    });
    socket.on("error", (err) => {
      console.error(`[Socket error] ${socket.id}:`, err.message);
    });
  });
};
