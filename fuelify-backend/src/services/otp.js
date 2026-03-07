// fuelify-backend/src/services/otp.js
const twilio = require('twilio');

// Returns: { success: true } or throws
const sendOtp = async (phone, otp) => {
  // Normalize phone to E.164 format - assume US if no country code
  const normalized = phone.startsWith('+') ? phone : `+1${phone.replace(/\D/g, '')}`;

  const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  await client.messages.create({
    body: `Your Fuelify verification code is: ${otp}. Expires in 10 minutes.`,
    from: process.env.TWILIO_PHONE_NUMBER,
    to: normalized,
  });

  return { success: true };
};

// Generates a 6-digit numeric OTP string
const generateOtp = () => Math.floor(100000 + Math.random() * 900000).toString();

// Returns OTP expiry date (10 minutes from now)
const generateExpiry = () => new Date(Date.now() + 10 * 60 * 1000);

module.exports = { sendOtp, generateOtp, generateExpiry };
