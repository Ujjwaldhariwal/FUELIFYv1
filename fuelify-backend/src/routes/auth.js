// fuelify-backend/src/routes/auth.js
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

const router = express.Router();
const Station = require('../models/Station');
const Owner = require('../models/Owner');
const { sendOtp, generateOtp, generateExpiry } = require('../services/otp');
const { sendWelcomeEmail } = require('../services/email');
const { otpLimiter, otpVerifyLimiter, loginLimiter } = require('../middleware/rateLimit');
const { scheduleStationCacheInvalidation } = require('../services/stationCache');

// Helper: sign JWT (7 day expiry)
const signToken = (ownerId) => jwt.sign({ id: ownerId }, process.env.JWT_SECRET, { expiresIn: '7d' });

// POST /api/auth/claim/initiate
router.post('/claim/initiate', otpLimiter, async (req, res, next) => {
  try {
    const { stationId, phone } = req.body;
    if (!stationId || !phone) {
      return res.status(400).json({ error: 'stationId and phone required' });
    }
    if (!mongoose.Types.ObjectId.isValid(stationId)) {
      return res.status(400).json({ error: 'Invalid stationId' });
    }

    const station = await Station.findById(stationId);
    if (!station) return res.status(404).json({ error: 'Station not found' });
    if (station.riskStatus === 'blocked') {
      return res.status(403).json({ error: 'Station claims are temporarily blocked' });
    }

    const existingOwner = await Owner.findOne({ phone });
    if (existingOwner?.isVerified && existingOwner.stationId.toString() === stationId) {
      return res.status(409).json({
        error: 'Station already claimed and verified. Please log in instead.',
      });
    }
    if (existingOwner?.isVerified && existingOwner.stationId.toString() !== stationId) {
      return res.status(409).json({ error: 'Phone already linked to another station claim' });
    }
    // Only reach upsert if owner does not exist OR is not yet verified

    if (station.status === 'CLAIMED' || station.status === 'VERIFIED') {
      return res.status(409).json({ error: 'Station already claimed' });
    }

    const otp = generateOtp();
    const expiry = generateExpiry();

    await Owner.findOneAndUpdate(
      { phone },
      {
        phone,
        stationId,
        verificationOtp: await bcrypt.hash(otp, 8),
        verificationExpiry: expiry,
        isVerified: false,
        name: 'Pending',
        email: `pending_${phone}@fuelify.internal`,
        passwordHash: '',
        role: 'OWNER',
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    await sendOtp(phone, otp);
    return res.json({ success: true, message: 'OTP sent' });
  } catch (err) {
    return next(err);
  }
});

// POST /api/auth/claim/verify
router.post('/claim/verify', otpVerifyLimiter, async (req, res, next) => {
  try {
    const { stationId, phone, otp, name, email, password } = req.body;

    if (!mongoose.Types.ObjectId.isValid(stationId)) {
      return res.status(400).json({ error: 'Invalid stationId' });
    }

    if (!stationId || !phone || !otp || !name || !email || !password) {
      return res.status(400).json({ error: 'All fields required' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const owner = await Owner.findOne({ phone, stationId });
    if (!owner) return res.status(404).json({ error: 'No pending claim found for this phone' });
    const stationBeforeVerify = await Station.findById(stationId).select('riskStatus').lean();
    if (!stationBeforeVerify) return res.status(404).json({ error: 'Station not found' });
    if (stationBeforeVerify.riskStatus === 'blocked') {
      return res.status(403).json({ error: 'Station claims are currently blocked' });
    }

    if (owner.otpLockedUntil && owner.otpLockedUntil > new Date()) {
      return res.status(429).json({ error: 'Too many failed OTP attempts. Try again later.' });
    }

    if (!owner.verificationExpiry || new Date() > owner.verificationExpiry) {
      return res.status(410).json({ error: 'OTP expired. Please request a new one.' });
    }

    const otpMatch = await bcrypt.compare(otp, owner.verificationOtp);
    if (!otpMatch) {
      owner.otpFailureCount = (owner.otpFailureCount || 0) + 1;
      if (owner.otpFailureCount >= 5) {
        owner.otpLockedUntil = new Date(Date.now() + 15 * 60 * 1000);
      }
      await owner.save();
      return res.status(401).json({ error: 'Invalid OTP' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }
    owner.name = name;
    owner.email = email;
    owner.passwordHash = passwordHash;
    owner.isVerified = true;
    owner.verificationOtp = null;
    owner.verificationExpiry = null;
    owner.otpFailureCount = 0;
    owner.otpLockedUntil = null;
    await owner.save();

    const station = await Station.findByIdAndUpdate(
      stationId,
      { status: 'CLAIMED', claimedBy: owner._id, claimedAt: new Date() },
      { new: true }
    );
    await scheduleStationCacheInvalidation({ reason: 'CLAIM_ACCOUNT_VERIFIED', stationId: stationId.toString() });

    sendWelcomeEmail(email, name, station.name).catch(console.error);

    const token = signToken(owner._id);
    return res.json({ token, owner: { id: owner._id, name, email, role: owner.role }, station });
  } catch (err) {
    return next(err);
  }
});

// POST /api/auth/login
router.post('/login', loginLimiter, async (req, res, next) => {
  try {
    const { identifier, password } = req.body;
    if (!identifier || !password) {
      return res.status(400).json({ error: 'Identifier and password required' });
    }

    const owner = await Owner.findOne({
      $or: [{ email: identifier.toLowerCase() }, { phone: identifier }],
    });

    if (!owner) return res.status(401).json({ error: 'Invalid credentials' });
    if (!owner.isVerified) return res.status(403).json({ error: 'Account not verified' });
    if (!owner.passwordHash) return res.status(403).json({ error: 'Account setup incomplete' });
    if (owner.loginLockedUntil && owner.loginLockedUntil > new Date()) {
      return res.status(429).json({ error: 'Account temporarily locked due to failed attempts' });
    }

    const valid = await bcrypt.compare(password, owner.passwordHash);
    if (!valid) {
      owner.loginFailureCount = (owner.loginFailureCount || 0) + 1;
      if (owner.loginFailureCount >= 8) {
        owner.loginLockedUntil = new Date(Date.now() + 15 * 60 * 1000);
      }
      await owner.save();
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    owner.loginFailureCount = 0;
    owner.loginLockedUntil = null;
    owner.lastLogin = new Date();
    await owner.save();

    const station = await Station.findById(owner.stationId).lean();
    const token = signToken(owner._id);

    return res.json({
      token,
      owner: { id: owner._id, name: owner.name, email: owner.email, role: owner.role },
      station,
    });
  } catch (err) {
    return next(err);
  }
});

// POST /api/auth/resend-otp
router.post('/resend-otp', otpLimiter, async (req, res, next) => {
  try {
    const { phone, stationId } = req.body;
    if (!mongoose.Types.ObjectId.isValid(stationId)) {
      return res.status(400).json({ error: 'Invalid stationId' });
    }
    const owner = await Owner.findOne({ phone, stationId });

    if (!owner) return res.status(404).json({ error: 'No pending claim found' });

    const otp = generateOtp();
    owner.verificationOtp = await bcrypt.hash(otp, 8);
    owner.verificationExpiry = generateExpiry();
    await owner.save();

    await sendOtp(phone, otp);
    return res.json({ success: true, message: 'New OTP sent' });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
