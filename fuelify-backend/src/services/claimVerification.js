const Station = require('../models/Station');
const { getPlaceDetails } = require('./placesAPI');

const COOLDOWN_HOURS = 24;
const APPROVAL_THRESHOLD = 0.78;

const clampScore = (value) => Math.max(0, Math.min(1, Number(value.toFixed(3))));

const normalizeText = (value = '') =>
  String(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const toTokens = (value = '') => normalizeText(value).split(' ').filter(Boolean);

const tokenSimilarity = (left = '', right = '') => {
  const a = new Set(toTokens(left));
  const b = new Set(toTokens(right));
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const token of a) if (b.has(token)) intersection += 1;
  const union = new Set([...a, ...b]).size;
  return intersection / union;
};

const normalizePhone = (value = '') => {
  const digits = String(value).replace(/\D/g, '');
  if (!digits) return '';
  return digits.length > 10 ? digits.slice(-10) : digits;
};

const normalizeDomain = (input = '') => {
  try {
    const url = input.startsWith('http') ? new URL(input) : new URL(`https://${input}`);
    return url.hostname.replace(/^www\./, '').toLowerCase();
  } catch (err) {
    return '';
  }
};

const getEmailDomain = (email = '') => email.split('@')[1]?.toLowerCase() || '';

const evaluateGoogleCheck = async ({ station, evidence }) => {
  let candidateName = station.name || '';
  let candidatePhone = station.phone || '';
  let candidateWebsite = station.website || '';

  const canUseGoogleDetails = Boolean(process.env.GOOGLE_PLACES_API_KEY && station.placeId);
  if (canUseGoogleDetails) {
    try {
      const details = await getPlaceDetails(station.placeId);
      if (details?.name) candidateName = details.name;
      if (details?.formatted_phone_number) candidatePhone = details.formatted_phone_number;
      if (details?.website) candidateWebsite = details.website;
    } catch (err) {
      // Keep fallback station data when provider lookup fails.
    }
  }

  const nameMatchScore = tokenSimilarity(evidence.businessName, candidateName);
  const phoneMatch =
    Boolean(normalizePhone(evidence.claimantPhone)) &&
    normalizePhone(evidence.claimantPhone) === normalizePhone(candidatePhone);
  const websiteMatch =
    Boolean(normalizeDomain(evidence.website)) &&
    normalizeDomain(evidence.website) === normalizeDomain(candidateWebsite);

  const confidence = clampScore(nameMatchScore + (phoneMatch ? 0.2 : 0) + (websiteMatch ? 0.2 : 0));
  return {
    matched: confidence >= 0.55,
    confidence,
  };
};

const evaluateOsmCheck = ({ station, evidence }) => {
  const hasOsmSignal = Boolean(station.osmId || station.dataSource === 'OSM' || station.address?.street);
  const nameScore = tokenSimilarity(evidence.businessName, station.name || '');
  const confidence = clampScore(hasOsmSignal ? nameScore + 0.2 : nameScore);
  return {
    matched: hasOsmSignal && confidence >= 0.5,
    confidence,
  };
};

const evaluateStateRegistryCheck = ({ station, evidence }) => {
  const registrationId = String(evidence.businessRegistrationId || '').trim().toUpperCase();
  const stateCode = String(station.address?.state || 'OH').toUpperCase();
  if (!registrationId) return { matched: false, confidence: 0 };

  const statePattern =
    stateCode === 'OH' ? /^OH[-\s]?[A-Z0-9]{6,}$/ : new RegExp(`^${stateCode}[-\\s]?[A-Z0-9]{5,}$`);
  const genericPattern = /^[A-Z0-9][A-Z0-9\-\s]{5,}$/;

  if (statePattern.test(registrationId)) return { matched: true, confidence: 1 };
  if (genericPattern.test(registrationId)) return { matched: true, confidence: 0.7 };
  return { matched: false, confidence: 0 };
};

const evaluateSourceChecks = async ({ station, evidence }) => {
  const [google, osm, stateRegistry] = await Promise.all([
    evaluateGoogleCheck({ station, evidence }),
    Promise.resolve(evaluateOsmCheck({ station, evidence })),
    Promise.resolve(evaluateStateRegistryCheck({ station, evidence })),
  ]);

  const websiteDomain = normalizeDomain(evidence.website || '');
  const emailDomain = getEmailDomain(evidence.claimantEmail);
  const domainVerified = Boolean(websiteDomain) && websiteDomain === emailDomain;

  return {
    checks: {
      googleMatch: google.matched,
      osmMatch: osm.matched,
      stateRegistryMatch: stateRegistry.matched,
    },
    confidence: {
      google: google.confidence,
      osm: osm.confidence,
      stateRegistry: stateRegistry.confidence,
      domain: domainVerified ? 1 : 0,
    },
    domainVerified,
  };
};

const scoreClaimRisk = ({ checks, confidence, stationRiskStatus }) => {
  if (stationRiskStatus === 'blocked') return 0;

  const weighted =
    confidence.google * 0.4 +
    confidence.osm * 0.25 +
    confidence.stateRegistry * 0.25 +
    confidence.domain * 0.1;

  let score = weighted;
  if (!checks.googleMatch) score -= 0.1;
  if (stationRiskStatus === 'watchlist') score -= 0.2;
  return clampScore(score);
};

const decideClaim = ({ score, stationRiskStatus, domainVerified, evidence }) => {
  if (stationRiskStatus === 'blocked') {
    return {
      status: 'BLOCKED',
      reasonCode: 'STATION_BLOCKED',
      message: 'This station is currently blocked for verification.',
      retryAt: new Date(Date.now() + COOLDOWN_HOURS * 60 * 60 * 1000),
    };
  }

  if (evidence.website && evidence.claimantEmail && !domainVerified) {
    return {
      status: 'REJECTED',
      reasonCode: 'DOMAIN_MISMATCH',
      message: 'Website and claimant email domains do not match.',
      retryAt: new Date(Date.now() + COOLDOWN_HOURS * 60 * 60 * 1000),
    };
  }

  if (score >= APPROVAL_THRESHOLD) {
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

  const { checks, confidence, domainVerified } = await evaluateSourceChecks({ station, evidence });
  const score = scoreClaimRisk({
    checks,
    confidence,
    stationRiskStatus: station.riskStatus || 'clean',
  });
  const decision = decideClaim({
    score,
    stationRiskStatus: station.riskStatus || 'clean',
    domainVerified,
    evidence,
  });

  return {
    station,
    sourceChecks: checks,
    domainVerified,
    decisionConfidence: score,
    ...decision,
  };
};

module.exports = {
  verifyClaim,
  tokenSimilarity,
  normalizeDomain,
};
