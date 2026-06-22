const { webcrypto } = require("node:crypto");

const encoder = new TextEncoder();

function decodeBase64(value) {
  if (typeof value !== "string" || !value || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) return null;
  const bytes = Buffer.from(value, "base64");
  return bytes.length ? bytes : null;
}

async function verifyEnvelopeSignature(payload, signature, publicKeyValue) {
  try {
    if (typeof payload !== "string" || typeof publicKeyValue !== "string") return false;
    const signatureBytes = decodeBase64(signature);
    if (!signatureBytes) return false;
    const bundle = JSON.parse(publicKeyValue);
    if (bundle?.v !== 1 || !bundle.signing) return false;
    const key = await webcrypto.subtle.importKey(
      "jwk",
      bundle.signing,
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["verify"],
    );
    return webcrypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      key,
      signatureBytes,
      encoder.encode(payload),
    );
  } catch (_error) {
    return false;
  }
}

module.exports = { verifyEnvelopeSignature };

