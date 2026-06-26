const crypto = require("crypto");
const fs = require("fs/promises");
const path = require("path");
const jwt = require("jsonwebtoken");
const cloudinaryUtils = require("./cloudinary.utils");

const LOCAL_PREFIX = "local:";

function cloudinaryConfigured(env = process.env) {
  return Boolean(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET);
}

function localStorageDir() {
  return path.resolve(process.env.FILE_LOCAL_STORAGE_DIR || path.join(process.cwd(), "storage", "files"));
}

function localFilename(publicId) {
  if (typeof publicId !== "string" || !publicId.startsWith(LOCAL_PREFIX)) return null;
  const name = publicId.slice(LOCAL_PREFIX.length);
  if (!/^[a-f0-9-]+\.enc$/i.test(name)) return null;
  return name;
}

function localPath(publicId) {
  const name = localFilename(publicId);
  return name ? path.join(localStorageDir(), name) : null;
}

async function uploadEncryptedFile(buffer, mimeType = "application/octet-stream") {
  if (cloudinaryConfigured()) {
    const uploaded = await cloudinaryUtils.uploadToCloudinary(buffer, mimeType, "securechat/messages");
    return {
      publicId: uploaded.publicId,
      url: uploaded.url,
      provider: "cloudinary",
    };
  }

  const filename = `${crypto.randomUUID()}.enc`;
  await fs.mkdir(localStorageDir(), { recursive: true });
  await fs.writeFile(path.join(localStorageDir(), filename), buffer, { flag: "wx" });
  const publicId = `${LOCAL_PREFIX}${filename}`;
  return {
    publicId,
    url: signedEncryptedFileUrl(publicId),
    provider: "local",
  };
}

function signedEncryptedFileUrl(publicId) {
  if (!publicId?.startsWith(LOCAL_PREFIX)) return null;
  const token = jwt.sign(
    { scope: "encrypted-file", publicId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.FILE_TOKEN_EXPIRES_IN || "7d" },
  );
  return `/files/blob/${encodeURIComponent(token)}`;
}

function publicFileUrl(req, publicId, storedUrl) {
  if (!publicId?.startsWith(LOCAL_PREFIX)) return storedUrl;
  const relativeUrl = signedEncryptedFileUrl(publicId);
  return `${req.protocol}://${req.get("host")}${relativeUrl}`;
}

async function readSignedEncryptedFile(token) {
  const payload = jwt.verify(token, process.env.JWT_SECRET);
  if (payload?.scope !== "encrypted-file" || typeof payload.publicId !== "string") {
    const error = new Error("Invalid encrypted file token.");
    error.status = 403;
    throw error;
  }
  const filePath = localPath(payload.publicId);
  if (!filePath) {
    const error = new Error("Encrypted file is not stored locally.");
    error.status = 404;
    throw error;
  }
  return fs.readFile(filePath);
}

module.exports = {
  publicFileUrl,
  readSignedEncryptedFile,
  uploadEncryptedFile,
};
