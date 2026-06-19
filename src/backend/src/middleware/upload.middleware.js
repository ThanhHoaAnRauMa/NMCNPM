const multer = require("multer");

const ALLOWED_MIME_TYPES = new Set([
  "application/octet-stream",
  "image/jpeg",
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
]);

const maxSizeMb = Number.parseInt(process.env.MAX_FILE_SIZE_MB || "10", 10);

module.exports = multer({
  storage: multer.memoryStorage(),
  fileFilter: (_req, file, callback) => {
    if (ALLOWED_MIME_TYPES.has(file.mimetype)) return callback(null, true);
    return callback(new Error(`File type is not supported: ${file.mimetype}`), false);
  },
  limits: { fileSize: maxSizeMb * 1024 * 1024 },
});
