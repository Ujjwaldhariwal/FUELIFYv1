// fuelify-backend/src/middleware/rateLimit.js
const rateLimit = require('express-rate-limit');

const createRateLimitHandler = (message) => (req, res) =>
  res.status(429).json({
    success: false,
    error: message,
    code: 'RATE_LIMITED',
    requestId: req.requestId || null,
  });

// OTP endpoint: max 5 requests per phone per 15 minutes
const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  keyGenerator: (req) => req.body.phone || req.ip,
  handler: createRateLimitHandler('Too many OTP requests. Please wait 15 minutes.'),
});

// General public API: 100 req/min per IP
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  handler: createRateLimitHandler('Too many requests from this IP.'),
});

// Report endpoint: 10 reports per IP per hour
const reportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  handler: createRateLimitHandler('Too many reports from this IP.'),
});

// Login endpoint: 10 attempts per IP per 15 minutes
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  handler: createRateLimitHandler('Too many login attempts. Try again later.'),
});

// OTP verify endpoint: 8 attempts per phone/IP per 15 minutes
const otpVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  keyGenerator: (req) => req.body.phone || req.ip,
  handler: createRateLimitHandler('Too many OTP verification attempts. Please wait 15 minutes.'),
});

// Claim submission/retry endpoints: 6 attempts per identity per hour
const claimLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 6,
  keyGenerator: (req) => req.body?.evidence?.claimantPhone || req.ip,
  handler: createRateLimitHandler('Too many claim attempts. Please try again later.'),
});

// Price report submit endpoint: 5 requests per IP per 10 minutes
const priceLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  handler: createRateLimitHandler('Too many price submissions. Please try again later.'),
});

// Price confirm endpoint: 10 requests per IP per 10 minutes
const confirmLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 10,
  handler: createRateLimitHandler('Too many confirmation attempts. Please try again later.'),
});

module.exports = {
  otpLimiter,
  apiLimiter,
  reportLimiter,
  loginLimiter,
  otpVerifyLimiter,
  claimLimiter,
  priceLimiter,
  confirmLimiter,
};
