const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

const Claim = require('../models/Claim');
const Station = require('../models/Station');
const Owner = require('../models/Owner');
const { claimLimiter } = require('../middleware/rateLimit');
const { validateObjectIdParam } = require('../middleware/validateObjectId');
const { requireAuth } = require('../middleware/auth');
const { verifyClaim } = require('../services/claimVerification');
const { scoreStationRisk } = require('../services/stationRiskScorer');
const { scheduleStationCacheInvalidation } = require('../services/stationCache');

const router = express.Router();

const SLA_HOURS = 24;

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

const syncStationVerificationStatus = async ({ stationId, claimStatus }) => {
  const station = await Station.findById(stationId).select('status claimedBy claimedAt');
  if (!station) return;

  if (claimStatus === 'APPROVED') {
    station.status = 'VERIFIED';
    if (!station.claimedAt) station.claimedAt = new Date();
    await station.save();
    return;
  }

  if (station.claimedBy) {
    station.status = 'CLAIMED';
    if (!station.claimedAt) station.claimedAt = new Date();
    await station.save();
    return;
  }

  station.status = 'UNCLAIMED';
  station.claimedAt = null;
  await station.save();
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

const canAccessClaim = (claim, owner) =>
  owner?.role === 'ADMIN' || (claim.ownerId && claim.ownerId.toString() === owner?._id?.toString());

const resolveOptionalVerifiedOwner = async (req) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.split(' ')[1];
  if (!token) return null;

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded?.id || !mongoose.Types.ObjectId.isValid(decoded.id)) return null;
    const owner = await Owner.findById(decoded.id).select('_id role isVerified').lean();
    if (!owner || owner.isVerified !== true) return null;
    return owner;
  } catch (err) {
    return null;
  }
};

// POST /api/claims
router.post('/', requireAuth, claimLimiter, async (req, res, next) => {
  try {
    const { stationId, evidence } = req.body;
    const requestId = req.requestId;
    if (!stationId || !mongoose.Types.ObjectId.isValid(stationId)) {
      return res.status(400).json({ code: 'INVALID_STATION_ID', message: 'Invalid stationId', requestId });
    }

    const validationError = validateClaimEvidence(evidence);
    if (validationError) {
      return res.status(400).json({ code: 'INVALID_EVIDENCE', message: validationError, requestId });
    }

    const stationRecord = await Station.findById(stationId).select('_id claimedBy status');
    if (!stationRecord) {
      return res.status(404).json({ code: 'STATION_NOT_FOUND', message: 'Station not found', requestId });
    }
    if (!stationRecord.claimedBy) {
      return res.status(409).json({
        code: 'STATION_NOT_CLAIMED',
        message: 'Station must be claimed before verification review',
        requestId,
      });
    }
    if (stationRecord.claimedBy.toString() !== req.owner._id.toString()) {
      return res.status(403).json({
        code: 'FORBIDDEN_STATION_ACCESS',
        message: 'You can only submit verification for your claimed station',
        requestId,
      });
    }
    if (stationRecord.status !== 'CLAIMED' && stationRecord.status !== 'VERIFIED') {
      return res.status(409).json({
        code: 'INVALID_STATION_STATUS',
        message: 'Station is not in a verification-eligible state',
        requestId,
      });
    }

    const pendingClaim = await Claim.findOne({
      stationId,
      ownerId: req.owner._id,
      status: 'PENDING',
    })
      .sort({ createdAt: -1 })
      .select('_id retryAt');
    if (pendingClaim) {
      return res.status(409).json({
        code: 'CLAIM_ALREADY_PENDING',
        message: 'A verification request is already in progress',
        claimId: pendingClaim._id,
        retryAt: pendingClaim.retryAt || null,
        requestId,
      });
    }

    const claimResult = await verifyClaim({ stationId, evidence });
    const claim = await Claim.create({
      stationId,
      ownerId: req.owner._id,
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

    await syncStationVerificationStatus({ stationId, claimStatus: claim.status });
    await applyStationRiskUpdate(stationId);
    await scheduleStationCacheInvalidation({ reason: 'CLAIM_CREATED', stationId });

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
router.get('/:id/status', requireAuth, validateObjectIdParam('id'), async (req, res, next) => {
  try {
    const requestId = req.requestId;
    const claim = await Claim.findById(req.params.id).select('ownerId status reasonCode message retryAt slaEta').lean();
    if (!claim) {
      return res.status(404).json({ code: 'CLAIM_NOT_FOUND', message: 'Claim not found', requestId });
    }
    if (!canAccessClaim(claim, req.owner)) {
      return res.status(403).json({ code: 'FORBIDDEN_CLAIM_ACCESS', message: 'Claim access denied', requestId });
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

// GET /api/claims/station/:stationId/summary
router.get('/station/:stationId/summary', validateObjectIdParam('stationId'), async (req, res, next) => {
  try {
    const station = await Station.findById(req.params.stationId)
      .select('_id status riskStatus riskScore riskReasons riskEvaluatedAt blockedAt')
      .lean();
    if (!station) {
      return res
        .status(404)
        .json({ code: 'STATION_NOT_FOUND', message: 'Station not found', requestId: req.requestId });
    }

    const latestClaim = await Claim.findOne({ stationId: station._id })
      .sort({ createdAt: -1 })
      .select(
        '_id ownerId status reasonCode message decisionConfidence sourceChecks retryCount retryAt slaEta decidedAt createdAt updatedAt'
      )
      .lean();

    const publicClaim = latestClaim
      ? {
          claimId: latestClaim._id,
          status: latestClaim.status,
          canRetry:
            (latestClaim.status === 'REJECTED' || latestClaim.status === 'BLOCKED') &&
            (!latestClaim.retryAt || latestClaim.retryAt <= new Date()),
          retryAt: latestClaim.retryAt,
          slaEta: latestClaim.slaEta,
          createdAt: latestClaim.createdAt,
          updatedAt: latestClaim.updatedAt,
        }
      : null;

    const optionalOwner = await resolveOptionalVerifiedOwner(req);
    const canViewSensitive = Boolean(latestClaim && optionalOwner && canAccessClaim(latestClaim, optionalOwner));

    const response = {
      stationId: station._id,
      stationStatus: station.status,
      claim: publicClaim,
      requestId: req.requestId,
    };

    if (canViewSensitive) {
      response.risk = {
        status: station.riskStatus,
        score: station.riskScore,
        reasons: station.riskReasons || [],
        evaluatedAt: station.riskEvaluatedAt,
        blockedAt: station.blockedAt,
      };
      response.claim = {
        ...publicClaim,
        reasonCode: latestClaim.reasonCode,
        message: latestClaim.message,
        decisionConfidence: latestClaim.decisionConfidence,
        sourceChecks: latestClaim.sourceChecks,
        retryCount: latestClaim.retryCount,
        decidedAt: latestClaim.decidedAt,
      };
    }

    return res.json(response);
  } catch (err) {
    return next(err);
  }
});

// POST /api/claims/:id/retry
router.post('/:id/retry', requireAuth, validateObjectIdParam('id'), claimLimiter, async (req, res, next) => {
  try {
    const requestId = req.requestId;
    const claim = await Claim.findById(req.params.id);
    if (!claim) {
      return res.status(404).json({ code: 'CLAIM_NOT_FOUND', message: 'Claim not found', requestId });
    }
    if (!canAccessClaim(claim, req.owner)) {
      return res.status(403).json({ code: 'FORBIDDEN_CLAIM_ACCESS', message: 'Claim access denied', requestId });
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

    await syncStationVerificationStatus({ stationId: claim.stationId, claimStatus: claim.status });
    await applyStationRiskUpdate(claim.stationId);
    await scheduleStationCacheInvalidation({ reason: 'CLAIM_RETRIED', stationId: claim.stationId.toString() });

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
