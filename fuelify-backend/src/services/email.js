// fuelify-backend/src/services/email.js
const nodemailer = require('nodemailer');

const PLACEHOLDER_PATTERNS = ['placeholder', 'your_', 'example', 'changeme'];

const isMeaningfulValue = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return false;
  return !PLACEHOLDER_PATTERNS.some((token) => normalized.includes(token));
};

const isSmtpConfigured = () => {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  return (
    isMeaningfulValue(host) &&
    isMeaningfulValue(port) &&
    isMeaningfulValue(user) &&
    isMeaningfulValue(pass)
  );
};

const createTransport = () =>
  nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT, 10),
    secure: process.env.SMTP_PORT === '465',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });

const sendMailSafely = async (payload) => {
  if (!isSmtpConfigured()) return { sent: false, reason: 'SMTP_NOT_CONFIGURED' };

  try {
    const transporter = createTransport();
    await transporter.sendMail(payload);
    return { sent: true };
  } catch (err) {
    // Non-blocking behavior: email failures should not fail claim/login flows.
    return { sent: false, reason: 'SMTP_SEND_FAILED', error: err?.message || 'Unknown SMTP error' };
  }
};

const sendWelcomeEmail = async (to, ownerName, stationName) => {
  return sendMailSafely({
    from: `"Fuelify" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
    to,
    subject: `You've claimed ${stationName} on Fuelify!`,
    html: `
      <h2>Welcome to Fuelify, ${ownerName}!</h2>
      <p>Your station <strong>${stationName}</strong> is now verified and live.</p>
      <p>Log in to start updating your fuel prices.</p>
      <a href="https://dashboard.fuelify.com">Go to Dashboard</a>
    `,
  });
};

const sendPriceUpdateAlert = async (to, stationName, prices) => {
  return sendMailSafely({
    from: `"Fuelify" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
    to,
    subject: `Price update confirmed - ${stationName}`,
    html: `
      <h2>Prices Updated</h2>
      <p>Regular: $${prices.regular ?? 'N/A'}</p>
      <p>Midgrade: $${prices.midgrade ?? 'N/A'}</p>
      <p>Premium: $${prices.premium ?? 'N/A'}</p>
      <p>Diesel: $${prices.diesel ?? 'N/A'}</p>
    `,
  });
};

module.exports = { sendWelcomeEmail, sendPriceUpdateAlert, isSmtpConfigured };
