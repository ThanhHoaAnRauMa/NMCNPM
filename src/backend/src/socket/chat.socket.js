const Message = require("../models/Message.model");
const Conversation = require("../models/Conversation.model");
const User = require("../models/User.model");

const onlineUsers = new Map();

const pendingPrivacy = new Map();

module.exports = (io) => {
  io.on("connection", (socket) => {
    console.log(`🔌 Socket connected: ${socket.id}`);

    socket.on("user_online", async (data) => {
      try {
        const userId = data?.userId;
        if (!userId) return;

        onlineUsers.set(userId, socket.id);
        socket.userId = userId;

        await User.findByIdAndUpdate(userId, { isOnline: true });

        socket.broadcast.emit("user_status", { userId, isOnline: true });
        console.log(`👤 User online: ${userId}`);
      } catch (err) {
        console.error("❌ [user_online error]", err);
      }
    });

    socket.on("join_conversation", ({ conversationId }) => {
      socket.join(conversationId);
      console.log(`💬 Socket ${socket.id} joined room: ${conversationId}`);
    });

    socket.on("leave_conversation", ({ conversationId }) => {
      socket.leave(conversationId);
    });

    socket.on("send_message", async (data) => {
      try {
        const {
          conversationId,
          encryptedContent,
          signature,
          msgType,
          replyTo,
          tempId,
        } = data;
        const senderId = socket.userId;

        const conv = await Conversation.findById(conversationId);
        if (!conv) {
          socket.emit("message_error", {
            tempId,
            error: "Conversation không tồn tại",
          });
          return;
        }

        const isMember = conv.members.some((m) => m.toString() === senderId);
        if (!isMember) {
          socket.emit("message_error", {
            tempId,
            error: "Bạn không phải thành viên của conversation này",
          });
          return;
        }

        if (conv.mode === "PRIVACY") {
          socket.emit("message_error", {
            tempId,
            error: "Dùng event send_private_message cho Privacy Mode",
          });
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

        io.to(conversationId).emit("new_message", {
          _id: message._id,
          conversationId,
          senderId,
          encryptedContent: message.encryptedContent,
          signature: message.signature,
          msgType: message.msgType,
          status: message.status,
          replyTo: message.replyTo,
          createdAt: message.createdAt,
          tempId,
        });

        conv.members.forEach(async (memberId) => {
          if (memberId.toString() !== senderId) {
            const receiverSocketId = onlineUsers.get(memberId.toString());
            if (receiverSocketId) {
              await Message.findByIdAndUpdate(message._id, {
                status: "DELIVERED",
              });
              io.to(conversationId).emit("message_status", {
                messageId: message._id,
                status: "DELIVERED",
              });
            }
          }
        });
      } catch (err) {
        console.error("[send_message error]", err);
        socket.emit("message_error", { error: "Lỗi server khi gửi tin nhắn" });
      }
    });
    socket.on("send_private_message", async (data) => {
      const { conversationId, encryptedContent, signature, tempId } = data;
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
        console.log(`🔒 Privacy message ${tempId} cleared after double ACK`);
      }
    });

    socket.on("mark_seen", async ({ messageId, conversationId }) => {
      try {
        await Message.findByIdAndUpdate(messageId, { status: "SEEN" });

        io.to(conversationId).emit("message_status", {
          messageId,
          status: "SEEN",
          seenBy: socket.userId,
        });
      } catch (err) {
        console.error("[mark_seen error]", err);
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

    socket.on("disconnect", async () => {
      try {
        if (socket.userId) {
          onlineUsers.delete(socket.userId);

          await User.findByIdAndUpdate(socket.userId, {
            isOnline: false,
            lastSeen: new Date(),
          });

          socket.broadcast.emit("user_status", {
            userId: socket.userId,
            isOnline: false,
            lastSeen: new Date(),
          });
          console.log(`🔴 User offline: ${socket.userId}`);
        }
      } catch (err) {
        console.error("❌ [disconnect error]", err);
      }
    });
  });
};
