const nodemailer = require("nodemailer");

function hasSmtpConfig() {
  return Boolean(process.env.EMAIL_USER && process.env.EMAIL_PASSWORD);
}

function isProduction() {
  return process.env.NODE_ENV === "production";
}

function createTransporter() {
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
  });
}

function fromAddress() {
  const address = process.env.EMAIL_FROM || process.env.EMAIL_USER;
  const name = process.env.EMAIL_FROM_NAME || "Secure Chat Forensics";
  return `"${name.replace(/"/g, "")}" <${address}>`;
}

async function sendRegistrationOtpEmail({ email, username, otp, expiresInMinutes }) {
  if (!hasSmtpConfig()) {
    if (isProduction()) {
      const error = new Error("Email sender is not configured.");
      error.code = "EMAIL_NOT_CONFIGURED";
      throw error;
    }
    return { skipped: true };
  }

  const transporter = createTransporter();
  await transporter.sendMail({
    from: fromAddress(),
    to: email,
    subject: "Your Secure Chat registration OTP",
    text: [
      `Hello ${username},`,
      "",
      `Your registration OTP is ${otp}.`,
      `This code expires in ${expiresInMinutes} minutes.`,
      "",
      "If you did not request this account, you can ignore this email.",
    ].join("\n"),
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.5;color:#0f172a">
        <p>Hello ${escapeHtml(username)},</p>
        <p>Your registration OTP is:</p>
        <p style="font-size:28px;font-weight:700;letter-spacing:6px">${otp}</p>
        <p>This code expires in ${expiresInMinutes} minutes.</p>
        <p>If you did not request this account, you can ignore this email.</p>
      </div>
    `,
  });
  return { skipped: false };
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

module.exports = { hasSmtpConfig, sendRegistrationOtpEmail };
