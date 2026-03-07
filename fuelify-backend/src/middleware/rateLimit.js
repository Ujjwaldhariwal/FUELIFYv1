// fuelify-backend/src/middleware/rateLimit.js
const rateLimit = require('express-rate-limit');

// OTP endpoint: max 5 requests per phone per 15 minutes
const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  keyGenerator: (req) => req.body.phone || req.ip,
  message: { error: 'Too many OTP requests. Please wait 15 minutes.' },
});

// General public API: 100 req/min per IP
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: { error: 'Too many requests from this IP.' },
});

// Report endpoint: 10 reports per IP per hour
const reportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: { error: 'Too many reports from this IP.' },
});

module.exports = { otpLimiter, apiLimiter, reportLimiter };
