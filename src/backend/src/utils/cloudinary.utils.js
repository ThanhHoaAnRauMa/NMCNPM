const cloudinary = require("cloudinary").v2;

function getCloudinaryConfig(env = process.env) {
  const config = {
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
  };

  if (!config.cloud_name || !config.api_key || !config.api_secret) {
    throw new Error("Cloudinary credentials are not configured.");
  }

  return config;
}

function configureCloudinary() {
  const config = getCloudinaryConfig();
  cloudinary.config(config);
  return config;
}

exports.getCloudinaryConfig = getCloudinaryConfig;

/**
 * Upload file buffer lên Cloudinary.
 *
 * @param {Buffer} fileBuffer
 * @param {string} mimeType
 * @param {string} folder
 * @returns {Promise<{ url, publicId, bytes, format }>}
 */
exports.uploadToCloudinary = (
  fileBuffer,
  mimeType,
  folder = "securechat/messages",
) => {
  return new Promise((resolve, reject) => {
    try {
      configureCloudinary();
    } catch (error) {
      reject(error);
      return;
    }

    let resourceType = "raw";
    if (mimeType.startsWith("image/")) resourceType = "image";
    if (mimeType.startsWith("video/")) resourceType = "video";
    if (mimeType.startsWith("audio/")) resourceType = "video";

    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: resourceType,
      },
      (error, result) => {
        if (error) {
          reject(error);
          return;
        }
        resolve({
          url: result.secure_url,
          publicId: result.public_id,
          bytes: result.bytes,
          format: result.format,
        });
      },
    );

    uploadStream.end(fileBuffer);
  });
};

/**
 * Xóa file khỏi Cloudinary theo publicId.
 *
 * @param {string} publicId
 * @param {string} resourceType
 */
exports.deleteFromCloudinary = async (publicId, resourceType = "image") => {
  try {
    configureCloudinary();
    await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
    });
  } catch (err) {
    console.error("[deleteFromCloudinary]", err.message);
  }
};
