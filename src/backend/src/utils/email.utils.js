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
  const configuredAddress = String(process.env.EMAIL_FROM || "").trim();
  const address = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(configuredAddress) ? configuredAddress : process.env.EMAIL_USER;
  const name = process.env.EMAIL_FROM_NAME || "Secure Chat Forensics";
  return `"${name.replace(/"/g, "")}" <${address}>`;
}

async function sendMail(message) {
  const transporter = createTransporter();
  return transporter.sendMail({
    ...message,
    from: fromAddress(),
    envelope: {
      from: process.env.EMAIL_USER,
      to: message.to,
    },
    replyTo: process.env.EMAIL_USER,
  });
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

  const info = await sendMail({
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
  return { skipped: false, accepted: info.accepted || [], rejected: info.rejected || [], messageId: info.messageId };
}

async function sendPasswordChangeOtpEmail({ email, username, otp, expiresInMinutes }) {
  if (!hasSmtpConfig()) {
    if (isProduction()) {
      const error = new Error("Email sender is not configured.");
      error.code = "EMAIL_NOT_CONFIGURED";
      throw error;
    }
    return { skipped: true };
  }

  const info = await sendMail({
    to: email,
    subject: "Your Secure Chat password change OTP",
    text: [
      `Hello ${username},`,
      "",
      `Your password change OTP is ${otp}.`,
      `This code expires in ${expiresInMinutes} minutes.`,
      "",
      "If you did not request a password change, secure your account immediately.",
    ].join("\n"),
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.5;color:#0f172a">
        <p>Hello ${escapeHtml(username)},</p>
        <p>Your password change OTP is:</p>
        <p style="font-size:28px;font-weight:700;letter-spacing:6px">${otp}</p>
        <p>This code expires in ${expiresInMinutes} minutes.</p>
        <p>If you did not request a password change, secure your account immediately.</p>
      </div>
    `,
  });
  return { skipped: false, accepted: info.accepted || [], rejected: info.rejected || [], messageId: info.messageId };
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

module.exports = { hasSmtpConfig, isProduction, sendRegistrationOtpEmail, sendPasswordChangeOtpEmail };
