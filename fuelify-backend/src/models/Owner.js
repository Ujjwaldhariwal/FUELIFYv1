// fuelify-backend/src/models/Owner.js
const mongoose = require('mongoose');

const OwnerSchema = new mongoose.Schema(
  {
    stationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Station', required: true },
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    phone: { type: String, required: true, unique: true },
    cognitoSub: { type: String, default: null, index: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['OWNER', 'STAFF', 'ADMIN'], default: 'OWNER' },
    isVerified: { type: Boolean, default: false },
    verificationOtp: { type: String, default: null },
    verificationExpiry: { type: Date, default: null },
    otpFailureCount: { type: Number, default: 0 },
    otpLockedUntil: { type: Date, default: null },
    loginFailureCount: { type: Number, default: 0 },
    loginLockedUntil: { type: Date, default: null },
    lastLogin: { type: Date, default: null },
  },
  { timestamps: true }
);

OwnerSchema.index({ stationId: 1, isVerified: 1 });

module.exports = mongoose.model('Owner', OwnerSchema);
