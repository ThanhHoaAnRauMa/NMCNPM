const Message = require("../models/Message.model");
const Conversation = require("../models/Conversation.model");
const { uploadToCloudinary } = require("../utils/cloudinary.utils");

exports.uploadFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Không có file nào được gửi lên.",
      });
    }

    const { conversationId, encryptedContent, signature } = req.body;

    if (!conversationId) {
      return res.status(400).json({
        success: false,
        message: "Thiếu conversationId.",
      });
    }

    const conv = await Conversation.findById(conversationId);
    if (!conv) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy conversation." });
    }

    const isMember = conv.members.some((m) => m.toString() === req.userId);
    if (!isMember) {
      return res
        .status(403)
        .json({ success: false, message: "Bạn không phải thành viên." });
    }

    const uploaded = await uploadToCloudinary(
      req.file.buffer,
      req.file.mimetype,
      "securechat/messages",
    );

    const message = await Message.create({
      conversationId,
      senderId: req.userId,
      encryptedContent: encryptedContent || "[FILE_ATTACHMENT]",
      signature: signature || "none",
      msgType: "FILE",
      status: "SENT",
      fileUrl: uploaded.url,
      fileName: req.file.originalname,
      fileMime: req.file.mimetype,
      fileSizeBytes: uploaded.bytes,
      filePublicId: uploaded.publicId,
    });

    await Conversation.findByIdAndUpdate(conversationId, {
      lastMessage: message._id,
    });

    return res.status(201).json({
      success: true,
      message: {
        _id: message._id,
        conversationId,
        senderId: req.userId,
        msgType: "FILE",
        status: "SENT",
        fileUrl: uploaded.url,
        fileName: req.file.originalname,
        fileMime: req.file.mimetype,
        fileSizeBytes: uploaded.bytes,
        createdAt: message.createdAt,
      },
    });
  } catch (err) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({
        success: false,
        message: `File quá lớn. Tối đa ${process.env.MAX_FILE_SIZE_MB || 10}MB.`,
      });
    }
    if (err.message && err.message.includes("không được hỗ trợ")) {
      return res.status(400).json({ success: false, message: err.message });
    }
    console.error("[uploadFile]", err);
    return res
      .status(500)
      .json({ success: false, message: "Lỗi server khi upload file." });
  }
};

exports.getFilesByConversation = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { type = "all", limit = 20, before } = req.query;

    let mimeFilter = {};
    if (type === "image") {
      mimeFilter = {
        fileMime: { $regex: /^(image|video)\// },
      };
    } else if (type === "file") {
      mimeFilter = {
        fileMime: { $not: /^(image|video)\// },
      };
    }

    const query = {
      conversationId,
      msgType: "FILE",
      ...mimeFilter,
    };

    if (before) {
      query._id = { $lt: before };
    }

    const files = await Message.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .populate("senderId", "username avatarUrl")
      .select("_id fileUrl fileName fileMime fileSizeBytes senderId createdAt");

    const nextCursor =
      files.length === parseInt(limit) ? files[files.length - 1]._id : null;

    return res.status(200).json({
      success: true,
      files: files.reverse(),
      nextCursor,
    });
  } catch (err) {
    console.error("[getFilesByConversation]", err);
    return res.status(500).json({ success: false, message: "Lỗi server." });
  }
};

exports.jumpToMessage = async (req, res) => {
  try {
    const { conversationId, messageId } = req.params;

    const message = await Message.findOne({
      _id: messageId,
      conversationId,
      msgType: "FILE",
    }).select("_id createdAt senderId fileName fileMime");

    if (!message) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy tin nhắn chứa file này.",
      });
    }

    return res.status(200).json({
      success: true,
      messageId: message._id,
      createdAt: message.createdAt,
      senderId: message.senderId,
      fileName: message.fileName,
      fileMime: message.fileMime,
    });
  } catch (err) {
    console.error("[jumpToMessage]", err);
    return res.status(500).json({ success: false, message: "Lỗi server." });
  }
};
