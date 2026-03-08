// fuelify-backend/src/services/otp.js
const twilio = require('twilio');

const isNonProduction = () => process.env.NODE_ENV !== 'production';

const hasUsableTwilioConfig = () => {
  const sid = String(process.env.TWILIO_ACCOUNT_SID || '').trim();
  const token = String(process.env.TWILIO_AUTH_TOKEN || '').trim();
  const from = String(process.env.TWILIO_PHONE_NUMBER || '').trim();
  return sid.startsWith('AC') && token.length > 8 && from.startsWith('+');
};

const isOtpBypassEnabled = () => {
  if (!isNonProduction()) return false;
  if (process.env.OTP_BYPASS_ENABLED === 'true') return true;
  // Local/dev safety net: if Twilio is not configured correctly, bypass OTP.
  return !hasUsableTwilioConfig();
};

const getBypassOtp = () => process.env.OTP_BYPASS_CODE || '123456';

const otpProviderConfigError = () => {
  const err = new Error('OTP provider is not configured. Enable OTP_BYPASS_ENABLED in local/dev or configure Twilio.');
  err.status = 503;
  err.code = 'OTP_PROVIDER_MISCONFIGURED';
  return err;
};

// Returns: { success: true } or throws
const sendOtp = async (phone, otp) => {
  if (isOtpBypassEnabled()) {
    return { success: true, bypass: true };
  }
  if (!hasUsableTwilioConfig()) {
    throw otpProviderConfigError();
  }

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
const generateOtp = () => {
  if (isOtpBypassEnabled()) {
    return getBypassOtp();
  }
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Returns OTP expiry date (10 minutes from now)
const generateExpiry = () => new Date(Date.now() + 10 * 60 * 1000);

module.exports = { sendOtp, generateOtp, generateExpiry, isOtpBypassEnabled, hasUsableTwilioConfig };
