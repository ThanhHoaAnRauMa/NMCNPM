const User = require("../models/User.model");

function isKycMode(mode) {
  return ["KYC", "Standard"].includes(String(mode));
}

async function validateKycConversationMembers(conversation) {
  if (!isKycMode(conversation?.mode)) return { valid: true };
  const memberIds = (conversation.members || []).map((member) => member.toString());
  const users = await User.find({ _id: { $in: memberIds } }).select("_id kycStatus publicKey").lean();
  if (users.length !== memberIds.length) {
    return { valid: false, status: 409, code: "KYC_MEMBER_MISSING", message: "One or more KYC conversation members no longer exist." };
  }
  if (users.some((user) => !user.publicKey)) {
    return { valid: false, status: 409, code: "PUBLIC_KEY_REQUIRED", message: "Every KYC conversation member must have a synchronized device key." };
  }
  if (users.some((user) => String(user.kycStatus).toUpperCase() !== "VERIFIED")) {
    return { valid: false, status: 403, code: "KYC_REQUIRED", message: "Every KYC conversation member must be verified before sending in KYC mode." };
  }
  return { valid: true };
}

module.exports = {
  isKycMode,
  validateKycConversationMembers,
};
