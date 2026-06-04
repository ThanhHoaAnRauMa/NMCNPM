const multer = require("multer");

const storage = multer.memoryStorage();

const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "video/mp4",
  "video/quicktime",
  "audio/mpeg",
  "audio/wav",
];

const fileFilter = (req, file, cb) => {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Loại file không được hỗ trợ: ${file.mimetype}`), false);
  }
};

const MAX_SIZE_MB = parseInt(process.env.MAX_FILE_SIZE_MB || "10");

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_SIZE_MB * 1024 * 1024,
  },
});

module.exports = upload;
