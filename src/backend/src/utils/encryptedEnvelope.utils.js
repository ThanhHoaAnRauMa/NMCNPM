const MAX_ENCRYPTED_MESSAGE_CHARS = 100000;
const MAX_SIGNATURE_CHARS = 16384;
const BASE64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/;

function parseEnvelope(value) {
  if (typeof value !== "string" || !value || value.length > MAX_ENCRYPTED_MESSAGE_CHARS) {
    return { error: "Encrypted payload is missing or too large." };
  }
  try {
    return { envelope: JSON.parse(value) };
  } catch (_error) {
    return { error: "Encrypted payload must be a JSON envelope." };
  }
}

function isBase64(value, maxDecodedBytes = 65536) {
  if (typeof value !== "string" || !value || !BASE64_PATTERN.test(value)) return false;
  return Buffer.from(value, "base64").length <= maxDecodedBytes;
}

function memberIdList(conversation) {
  return (conversation?.members || []).map((memberId) => memberId.toString());
}

function validateEncryptedEnvelope({ encryptedContent, signature, conversation, expectedKind = "text" }) {
  if (typeof signature !== "string" || !signature || signature.length > MAX_SIGNATURE_CHARS) {
    return { valid: false, code: "INVALID_SIGNATURE", message: "A valid message signature is required." };
  }

  const parsed = parseEnvelope(encryptedContent);
  if (parsed.error) return { valid: false, code: "INVALID_ENVELOPE", message: parsed.error };

  const envelope = parsed.envelope;
  const allowedVersions = new Set([1, 2]);
  if (!allowedVersions.has(envelope?.v) || envelope.kind !== expectedKind) {
    return { valid: false, code: "INVALID_ENVELOPE", message: `Encrypted envelope must be a ${expectedKind} envelope.` };
  }
  if (!["RSA-OAEP-256+A256GCM", "RSA-OAEP-SHA256+A256GCM"].includes(envelope.alg)) {
    return { valid: false, code: "UNSUPPORTED_ENCRYPTION", message: "Encrypted envelope uses an unsupported algorithm." };
  }
  if (!isBase64(envelope.iv, 12) || Buffer.from(envelope.iv, "base64").length !== 12) {
    return { valid: false, code: "INVALID_ENVELOPE", message: "AES-GCM IV must be 96 bits." };
  }
  if (!envelope.keys || typeof envelope.keys !== "object") {
    return { valid: false, code: "MISSING_RECIPIENT_KEYS", message: "Encrypted envelope must include wrapped keys." };
  }
  const missingMember = memberIdList(conversation).find((memberId) => !isBase64(envelope.keys[memberId], 512));
  if (missingMember) {
    return { valid: false, code: "MISSING_RECIPIENT_KEYS", message: "Encrypted envelope must include a wrapped key for every conversation member." };
  }
  if (expectedKind === "text" && !isBase64(envelope.ciphertext, 65536)) {
    return { valid: false, code: "INVALID_CIPHERTEXT", message: "Text envelope must include ciphertext." };
  }
  if (envelope.v === 2) {
    if (typeof envelope.sessionId !== "string" || !/^[0-9a-f-]{16,64}$/i.test(envelope.sessionId)) {
      return { valid: false, code: "INVALID_SESSION_KEY", message: "Session key id is invalid." };
    }
    if (!Number.isInteger(envelope.keyVersion) || envelope.keyVersion < 1) {
      return { valid: false, code: "INVALID_SESSION_KEY", message: "Session key version is invalid." };
    }
  }
  return { valid: true, envelope };
}

module.exports = {
  MAX_ENCRYPTED_MESSAGE_CHARS,
  MAX_SIGNATURE_CHARS,
  validateEncryptedEnvelope,
};
