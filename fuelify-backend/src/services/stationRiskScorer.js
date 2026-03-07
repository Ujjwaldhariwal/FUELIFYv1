const UserReport = require('../models/UserReport');
const Claim = require('../models/Claim');

const scoreStationRisk = async (station) => {
  const [reportCount, rejectedClaims] = await Promise.all([
    UserReport.countDocuments({ stationId: station._id }),
    Claim.countDocuments({ stationId: station._id, status: { $in: ['REJECTED', 'BLOCKED'] } }),
  ]);

  let riskScore = 0;
  const reasons = [];

  if (reportCount >= 3) {
    riskScore += 0.4;
    reasons.push('HIGH_REPORT_VOLUME');
  }

  if (rejectedClaims >= 2) {
    riskScore += 0.45;
    reasons.push('REPEATED_CLAIM_REJECTIONS');
  }

  if (station.status === 'VERIFIED' && !station.claimedBy) {
    riskScore += 0.35;
    reasons.push('VERIFIED_WITHOUT_OWNER');
  }

  const normalized = Math.max(0, Math.min(1, Number(riskScore.toFixed(3))));
  let riskStatus = 'clean';
  if (normalized >= 0.75) riskStatus = 'blocked';
  else if (normalized >= 0.4) riskStatus = 'watchlist';

  return {
    riskScore: normalized,
    riskStatus,
    riskReasons: reasons,
    riskEvaluatedAt: new Date(),
    blockedAt: riskStatus === 'blocked' ? new Date() : null,
  };
};

module.exports = { scoreStationRisk };
