// fuelify-backend/src/middleware/auth.js
const Owner = require('../models/Owner');
const { verifyAccessToken } = require('../services/tokenVerifier');

// Middleware: require valid JWT (any verified owner)
const requireAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const verified = verifyAccessToken(token);
    const ownerFilter = verified.ownerId
      ? { _id: verified.ownerId }
      : { cognitoSub: verified.cognitoSub };
    const owner = await Owner.findOne(ownerFilter).select('-passwordHash -verificationOtp');

    if (!owner) return res.status(401).json({ error: 'Owner not found' });
    if (!owner.isVerified) return res.status(403).json({ error: 'Account not verified' });

    req.owner = owner;
    return next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

// Middleware: require ADMIN role
const requireAdmin = async (req, res, next) => {
  if (!req.owner || req.owner.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  return next();
};

module.exports = { requireAuth, requireAdmin };
