// fuelify-backend/src/services/email.js
// fuelify-backend/src/services/email.js
const nodemailer = require('nodemailer');

const isSmtpConfigured = () => {
  const host = process.env.SMTP_HOST;
  return Boolean(host && host.length > 0 && host !== 'placeholder');
};

const createTransport = () =>
  nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT, 10),
    secure: process.env.SMTP_PORT === '465',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });

const sendWelcomeEmail = async (to, ownerName, stationName) => {
  if (!isSmtpConfigured()) return;
  const transporter = createTransport();
  await transporter.sendMail({
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
  if (!isSmtpConfigured()) return;
  const transporter = createTransport();
  await transporter.sendMail({
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

module.exports = { sendWelcomeEmail, sendPriceUpdateAlert };
