const crypto = require("crypto");
const fs = require("fs/promises");
const path = require("path");
const jwt = require("jsonwebtoken");
const cloudinaryUtils = require("./cloudinary.utils");

const LOCAL_PREFIX = "local:";
const MIME_EXTENSIONS = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);
const EXTENSION_MIME = new Map([
  ["jpg", "image/jpeg"],
  ["jpeg", "image/jpeg"],
  ["png", "image/png"],
  ["webp", "image/webp"],
]);

function cloudinaryConfigured(env = process.env) {
  return Boolean(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET);
}

function localStorageDir() {
  return path.resolve(process.env.KYC_LOCAL_STORAGE_DIR || path.join(process.cwd(), "storage", "kyc"));
}

function localFilename(publicId) {
  if (typeof publicId !== "string" || !publicId.startsWith(LOCAL_PREFIX)) return null;
  const name = publicId.slice(LOCAL_PREFIX.length);
  if (!/^[a-f0-9-]+\.(jpg|jpeg|png|webp)$/i.test(name)) return null;
  return name;
}

function localPath(publicId) {
  const name = localFilename(publicId);
  return name ? path.join(localStorageDir(), name) : null;
}

async function uploadKycDocument(buffer, mimeType) {
  if (cloudinaryConfigured()) {
    const uploaded = await cloudinaryUtils.uploadToCloudinary(buffer, mimeType, "securechat/kyc", { type: "authenticated" });
    return {
      provider: "cloudinary",
      publicId: uploaded.publicId,
      format: uploaded.format,
    };
  }

  const extension = MIME_EXTENSIONS.get(mimeType) || "bin";
  const filename = `${crypto.randomUUID()}.${extension}`;
  await fs.mkdir(localStorageDir(), { recursive: true });
  await fs.writeFile(path.join(localStorageDir(), filename), buffer, { flag: "wx" });
  return {
    provider: "local",
    publicId: `${LOCAL_PREFIX}${filename}`,
    format: extension,
  };
}

async function deleteKycDocument(publicId, resourceType = "image", type = "authenticated") {
  if (!publicId) return;
  const filePath = localPath(publicId);
  if (filePath) {
    await fs.unlink(filePath).catch((error) => {
      if (error.code !== "ENOENT") console.error("[deleteKycDocument]", error.message);
    });
    return;
  }
  await cloudinaryUtils.deleteFromCloudinary(publicId, resourceType, type);
}

function signedKycDocumentUrl(req, publicId, format) {
  if (!publicId) return null;
  if (!publicId.startsWith(LOCAL_PREFIX)) return cloudinaryUtils.signedAuthenticatedImageUrl(publicId, format);
  const token = jwt.sign(
    { scope: "kyc-document", publicId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.KYC_DOCUMENT_TOKEN_EXPIRES_IN || "15m" },
  );
  return `${req.protocol}://${req.get("host")}/kyc/documents/${encodeURIComponent(token)}`;
}

async function readSignedLocalDocument(token) {
  const payload = jwt.verify(token, process.env.JWT_SECRET);
  if (payload?.scope !== "kyc-document" || typeof payload.publicId !== "string") {
    const error = new Error("Invalid KYC document token.");
    error.status = 403;
    throw error;
  }
  const filePath = localPath(payload.publicId);
  if (!filePath) {
    const error = new Error("KYC document is not stored locally.");
    error.status = 404;
    throw error;
  }
  const extension = path.extname(filePath).slice(1).toLowerCase();
  return {
    buffer: await fs.readFile(filePath),
    mimeType: EXTENSION_MIME.get(extension) || "application/octet-stream",
  };
}

module.exports = {
  cloudinaryConfigured,
  deleteKycDocument,
  readSignedLocalDocument,
  signedKycDocumentUrl,
  uploadKycDocument,
};
