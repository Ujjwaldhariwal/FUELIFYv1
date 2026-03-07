const express = require('express');
const mongoose = require('mongoose');

const Claim = require('../models/Claim');
const Station = require('../models/Station');
const { claimLimiter } = require('../middleware/rateLimit');
const { validateObjectIdParam } = require('../middleware/validateObjectId');
const { verifyClaim } = require('../services/claimVerification');
const { scoreStationRisk } = require('../services/stationRiskScorer');
const { invalidateStationCache } = require('../services/stationCache');

const router = express.Router();

const SLA_HOURS = 24;

const buildRequestId = () => `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const validateClaimEvidence = (evidence) => {
  if (!evidence) return 'Evidence is required';
  const required = [
    'businessName',
    'businessRegistrationId',
    'claimantName',
    'claimantEmail',
    'claimantPhone',
  ];
  const missing = required.filter((field) => !evidence[field]);
  if (missing.length > 0) return `Missing evidence fields: ${missing.join(', ')}`;
  return null;
};

const applyStationRiskUpdate = async (stationId) => {
  const station = await Station.findById(stationId);
  if (!station) return;
  const risk = await scoreStationRisk(station);
  station.riskScore = risk.riskScore;
  station.riskStatus = risk.riskStatus;
  station.riskReasons = risk.riskReasons;
  station.riskEvaluatedAt = risk.riskEvaluatedAt;
  station.blockedAt = risk.blockedAt;
  await station.save();
};

// POST /api/claims
router.post('/', claimLimiter, async (req, res, next) => {
  try {
    const { stationId, evidence } = req.body;
    const requestId = buildRequestId();
    if (!stationId || !mongoose.Types.ObjectId.isValid(stationId)) {
      return res.status(400).json({ code: 'INVALID_STATION_ID', message: 'Invalid stationId', requestId });
    }

    const validationError = validateClaimEvidence(evidence);
    if (validationError) {
      return res.status(400).json({ code: 'INVALID_EVIDENCE', message: validationError, requestId });
    }

    const claimResult = await verifyClaim({ stationId, evidence });
    const claim = await Claim.create({
      stationId,
      evidence: { ...evidence, domainVerified: claimResult.domainVerified },
      status: claimResult.status,
      reasonCode: claimResult.reasonCode,
      message: claimResult.message,
      sourceChecks: claimResult.sourceChecks,
      decisionConfidence: claimResult.decisionConfidence,
      retryAt: claimResult.retryAt || null,
      decidedAt: claimResult.status === 'PENDING' ? null : new Date(),
      slaEta: new Date(Date.now() + SLA_HOURS * 60 * 60 * 1000),
    });

    await applyStationRiskUpdate(stationId);
    invalidateStationCache();

    return res.status(201).json({
      claimId: claim._id,
      status: claim.status,
      reasonCode: claim.reasonCode,
      message: claim.message,
      retryAt: claim.retryAt,
      slaEta: claim.slaEta,
      requestId,
    });
  } catch (err) {
    return next(err);
  }
});

// GET /api/claims/:id/status
router.get('/:id/status', validateObjectIdParam('id'), async (req, res, next) => {
  try {
    const requestId = buildRequestId();
    const claim = await Claim.findById(req.params.id).lean();
    if (!claim) {
      return res.status(404).json({ code: 'CLAIM_NOT_FOUND', message: 'Claim not found', requestId });
    }
    return res.json({
      status: claim.status,
      reasonCode: claim.reasonCode,
      message: claim.message,
      retryAt: claim.retryAt,
      slaEta: claim.slaEta,
      requestId,
    });
  } catch (err) {
    return next(err);
  }
});

// POST /api/claims/:id/retry
router.post('/:id/retry', validateObjectIdParam('id'), claimLimiter, async (req, res, next) => {
  try {
    const requestId = buildRequestId();
    const claim = await Claim.findById(req.params.id);
    if (!claim) {
      return res.status(404).json({ code: 'CLAIM_NOT_FOUND', message: 'Claim not found', requestId });
    }

    if (claim.status !== 'REJECTED' && claim.status !== 'BLOCKED') {
      return res.status(409).json({
        code: 'CLAIM_NOT_RETRYABLE',
        message: 'Only rejected or blocked claims can be retried',
        requestId,
      });
    }
    if (claim.retryAt && claim.retryAt > new Date()) {
      return res.status(429).json({
        code: 'CLAIM_RETRY_COOLDOWN',
        message: 'Claim is still in cooldown period',
        retryAt: claim.retryAt,
        requestId,
      });
    }

    const evidence = { ...claim.evidence.toObject(), ...(req.body.evidence || {}) };
    const validationError = validateClaimEvidence(evidence);
    if (validationError) {
      return res.status(400).json({ code: 'INVALID_EVIDENCE', message: validationError, requestId });
    }

    const claimResult = await verifyClaim({ stationId: claim.stationId, evidence });
    claim.evidence = { ...evidence, domainVerified: claimResult.domainVerified };
    claim.sourceChecks = claimResult.sourceChecks;
    claim.status = claimResult.status;
    claim.reasonCode = claimResult.reasonCode;
    claim.message = claimResult.message;
    claim.decisionConfidence = claimResult.decisionConfidence;
    claim.retryAt = claimResult.retryAt || null;
    claim.decidedAt = new Date();
    claim.retryCount += 1;
    await claim.save();

    await applyStationRiskUpdate(claim.stationId);
    invalidateStationCache();

    return res.json({
      status: claim.status,
      reasonCode: claim.reasonCode,
      message: claim.message,
      retryAt: claim.retryAt,
      slaEta: claim.slaEta,
      requestId,
    });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
