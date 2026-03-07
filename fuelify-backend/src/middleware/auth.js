// fuelify-backend/src/middleware/auth.js
const jwt = require('jsonwebtoken');
const Owner = require('../models/Owner');

// Middleware: require valid JWT (any verified owner)
const requireAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const owner = await Owner.findById(decoded.id).select('-passwordHash -verificationOtp');

    if (!owner) return res.status(401).json({ error: 'Owner not found' });
    if (!owner.isVerified) return res.status(403).json({ error: 'Account not verified' });

    req.owner = owner;
    return next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

// Middleware: require ADMIN role (checks role field AND admin secret header as fallback)
const requireAdmin = async (req, res, next) => {
  const adminKey = req.headers['x-admin-key'];
  if (adminKey && adminKey === process.env.ADMIN_SECRET_KEY) {
    req.isAdmin = true;
    return next();
  }

  if (!req.owner || req.owner.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  return next();
};

module.exports = { requireAuth, requireAdmin };
