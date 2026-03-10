const mongoose = require('mongoose');

const EvidenceSchema = new mongoose.Schema(
  {
    businessName: { type: String, required: true },
    businessRegistrationId: { type: String, required: true },
    claimantName: { type: String, required: true },
    claimantEmail: { type: String, required: true },
    claimantPhone: { type: String, required: true },
    website: { type: String, default: null },
    domainVerified: { type: Boolean, default: false },
  },
  { _id: false }
);

const SourceChecksSchema = new mongoose.Schema(
  {
    googleMatch: { type: Boolean, default: false },
    osmMatch: { type: Boolean, default: false },
    stateRegistryMatch: { type: Boolean, default: false },
  },
  { _id: false }
);

const ClaimSchema = new mongoose.Schema(
  {
    stationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Station', required: true, index: true },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Owner', default: null, index: true },
    evidence: { type: EvidenceSchema, required: true },
    status: {
      type: String,
      enum: ['PENDING', 'APPROVED', 'REJECTED', 'BLOCKED'],
      default: 'PENDING',
      index: true,
    },
    reasonCode: { type: String, default: null },
    message: { type: String, default: 'Verification in progress.' },
    decisionConfidence: { type: Number, min: 0, max: 1, default: 0 },
    sourceChecks: { type: SourceChecksSchema, default: () => ({}) },
    retryCount: { type: Number, default: 0 },
    retryAt: { type: Date, default: null },
    slaEta: { type: Date, required: true },
    decidedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

ClaimSchema.index({ stationId: 1, createdAt: -1 });
ClaimSchema.index({ ownerId: 1, createdAt: -1 });
ClaimSchema.index({ status: 1, retryAt: 1 });

module.exports = mongoose.model('Claim', ClaimSchema);
