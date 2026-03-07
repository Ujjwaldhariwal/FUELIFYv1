// fuelify-backend/src/models/Owner.js
const mongoose = require('mongoose');

const OwnerSchema = new mongoose.Schema(
  {
    stationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Station', required: true },
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    phone: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['OWNER', 'STAFF', 'ADMIN'], default: 'OWNER' },
    isVerified: { type: Boolean, default: false },
    verificationOtp: { type: String, default: null },
    verificationExpiry: { type: Date, default: null },
    lastLogin: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Owner', OwnerSchema);
