const Station = require('../models/Station');

const COOLDOWN_HOURS = 24;

const normalizeDomain = (input = '') => {
  try {
    const url = input.startsWith('http') ? new URL(input) : new URL(`https://${input}`);
    return url.hostname.replace(/^www\./, '').toLowerCase();
  } catch (err) {
    return '';
  }
};

const getEmailDomain = (email = '') => email.split('@')[1]?.toLowerCase() || '';

const evaluateSourceChecks = async ({ station, evidence }) => {
  const stationName = (station.name || '').toLowerCase();
  const stationStreet = (station.address?.street || '').toLowerCase();
  const websiteDomain = normalizeDomain(evidence.website || '');
  const emailDomain = getEmailDomain(evidence.claimantEmail);

  const googleMatch = stationName.includes((evidence.businessName || '').toLowerCase().slice(0, 8));
  const osmMatch = stationStreet.length > 0;
  const stateRegistryMatch = Boolean(evidence.businessRegistrationId) && evidence.businessRegistrationId.length >= 6;
  const domainVerified = Boolean(websiteDomain) && websiteDomain === emailDomain;

  return {
    checks: { googleMatch, osmMatch, stateRegistryMatch },
    domainVerified,
  };
};

const scoreClaimRisk = ({ checks, domainVerified, stationRiskStatus }) => {
  let score = 0;
  if (checks.googleMatch) score += 0.35;
  if (checks.osmMatch) score += 0.2;
  if (checks.stateRegistryMatch) score += 0.25;
  if (domainVerified) score += 0.2;
  if (stationRiskStatus === 'watchlist') score -= 0.25;
  if (stationRiskStatus === 'blocked') score = 0;
  return Math.max(0, Math.min(1, Number(score.toFixed(3))));
};

const decideClaim = ({ score, stationRiskStatus }) => {
  if (stationRiskStatus === 'blocked') {
    return {
      status: 'BLOCKED',
      reasonCode: 'STATION_BLOCKED',
      message: 'This station is currently blocked for verification.',
      retryAt: new Date(Date.now() + COOLDOWN_HOURS * 60 * 60 * 1000),
    };
  }

  if (score >= 0.75) {
    return {
      status: 'APPROVED',
      reasonCode: null,
      message: 'Claim verified automatically.',
      retryAt: null,
    };
  }

  return {
    status: 'REJECTED',
    reasonCode: 'LOW_CONFIDENCE',
    message: 'Unable to verify claim confidence. Please retry with stronger matching evidence.',
    retryAt: new Date(Date.now() + COOLDOWN_HOURS * 60 * 60 * 1000),
  };
};

const verifyClaim = async ({ stationId, evidence }) => {
  const station = await Station.findById(stationId).lean();
  if (!station) {
    const err = new Error('Station not found');
    err.status = 404;
    throw err;
  }

  const { checks, domainVerified } = await evaluateSourceChecks({ station, evidence });
  const score = scoreClaimRisk({
    checks,
    domainVerified,
    stationRiskStatus: station.riskStatus || 'clean',
  });
  const decision = decideClaim({ score, stationRiskStatus: station.riskStatus || 'clean' });

  return {
    station,
    sourceChecks: checks,
    domainVerified,
    decisionConfidence: score,
    ...decision,
  };
};

module.exports = { verifyClaim };
