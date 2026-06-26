const DEFAULT_FROM = "Secure Chat Forensics <no-reply@secure-chat.local>";

function debugEnabled() {
  return process.env.EMAIL_DEBUG_OTP === "true" || process.env.EMAIL_DELIVERY_MODE === "console";
}

function emailFrom() {
  return process.env.EMAIL_FROM || DEFAULT_FROM;
}

async function sendWithResend({ to, subject, text, html }) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: emailFrom(),
      to: [to],
      subject,
      text,
      html,
    }),
  });
  if (!response.ok) {
    const payload = await response.text().catch(() => "");
    const error = new Error(`Resend email failed: ${response.status} ${payload}`.slice(0, 500));
    error.code = "EMAIL_PROVIDER_FAILED";
    throw error;
  }
  return response.json().catch(() => ({}));
}

async function sendEmail(message) {
  if (process.env.RESEND_API_KEY) {
    return sendWithResend(message);
  }
  if (debugEnabled() || process.env.NODE_ENV !== "production") {
    console.info("[email:debug]", { to: message.to, subject: message.subject, text: message.text });
    return { debug: true };
  }
  const error = new Error("Email provider is not configured.");
  error.code = "EMAIL_NOT_CONFIGURED";
  throw error;
}

async function sendRegistrationOtp({ email, otp, expiresMinutes }) {
  return sendEmail({
    to: email,
    subject: "Secure Chat Forensics registration code",
    text: `Your Secure Chat Forensics registration code is ${otp}. It expires in ${expiresMinutes} minutes.`,
    html: `<p>Your Secure Chat Forensics registration code is <strong>${otp}</strong>.</p><p>It expires in ${expiresMinutes} minutes.</p>`,
  });
}

async function sendPasswordReset({ email, resetUrl, expiresMinutes }) {
  return sendEmail({
    to: email,
    subject: "Reset your Secure Chat Forensics password",
    text: `Use this link to reset your password: ${resetUrl}\n\nThis link expires in ${expiresMinutes} minutes.`,
    html: `<p>Use this link to reset your password:</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>This link expires in ${expiresMinutes} minutes.</p>`,
  });
}

module.exports = {
  debugEnabled,
  sendPasswordReset,
  sendRegistrationOtp,
};
