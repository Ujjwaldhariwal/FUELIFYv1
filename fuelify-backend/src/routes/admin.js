// fuelify-backend/src/routes/admin.js
const express = require('express');

const router = express.Router();
const Station = require('../models/Station');
const mongoose = require('mongoose');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { validateObjectIdParam } = require('../middleware/validateObjectId');
const { scheduleStationCacheInvalidation } = require('../services/stationCache');
const placesAPI = require('../services/placesAPI');

const MAX_STATIONS_LIMIT = 200;
const MAX_AUTOFIX_LIMIT = 500;
const AUTOFIX_DELAY_MS = 200;
const INCOMPLETE_ADDRESS_FILTER = {
  $or: [
    { 'address.street': { $exists: false } },
    { 'address.street': null },
    { 'address.street': { $not: /\S/ } },
    { 'address.city': { $exists: false } },
    { 'address.city': null },
    { 'address.city': { $not: /\S/ } },
  ],
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const toPositiveInt = (value, fallback) => {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const normalizeAddress = (payload = {}) => ({
  street: typeof payload.street === 'string' ? payload.street.trim() : '',
  city: typeof payload.city === 'string' ? payload.city.trim() : '',
  state: typeof payload.state === 'string' ? payload.state.trim().toUpperCase() : 'OH',
  zip: typeof payload.zip === 'string' ? payload.zip.trim() : '',
  country: typeof payload.country === 'string' ? payload.country.trim().toUpperCase() : 'US',
});

const parseFormattedAddress = (formatted = '') => {
  const parts = String(formatted)
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length < 2) return null;

  const street = parts[0] || '';
  const city = parts.length >= 3 ? parts[parts.length - 3] : parts[1];
  const stateZipRaw = parts.length >= 2 ? parts[parts.length - 2] : '';
  const country = (parts[parts.length - 1] || 'US').toUpperCase();

  const stateZipMatch = stateZipRaw.match(/([A-Za-z]{2})(?:\s+([A-Za-z0-9-]+))?/);

  return {
    street,
    city,
    state: stateZipMatch?.[1]?.toUpperCase() || 'OH',
    zip: stateZipMatch?.[2] || '',
    country,
  };
};

const extractAddressFromPlaceDetails = (details) => {
  const components = Array.isArray(details?.address_components) ? details.address_components : [];

  const byType = (type) =>
    components.find((component) => Array.isArray(component.types) && component.types.includes(type));

  const streetNumber = byType('street_number')?.long_name || '';
  const route = byType('route')?.long_name || '';
  const street = `${streetNumber} ${route}`.trim() || route || '';

  const city =
    byType('locality')?.long_name ||
    byType('postal_town')?.long_name ||
    byType('administrative_area_level_2')?.long_name ||
    byType('sublocality')?.long_name ||
    '';

  const state = byType('administrative_area_level_1')?.short_name || 'OH';
  const zip = byType('postal_code')?.long_name || '';
  const country = byType('country')?.short_name || 'US';

  if (street && city) {
    return {
      street: street.trim(),
      city: city.trim(),
      state: String(state).trim().toUpperCase(),
      zip: String(zip).trim(),
      country: String(country).trim().toUpperCase(),
    };
  }

  return parseFormattedAddress(details?.formatted_address);
};

const buildAddressUpdate = (station, parsedAddress) => {
  if (!parsedAddress?.street || !parsedAddress?.city) return null;

  return {
    street: parsedAddress.street.trim(),
    city: parsedAddress.city.trim(),
    state: parsedAddress.state || station?.address?.state || 'OH',
    zip: parsedAddress.zip || station?.address?.zip || '',
    country: parsedAddress.country || station?.address?.country || 'US',
  };
};

// All admin routes require auth + ADMIN role
router.use(requireAuth);
router.use(requireAdmin);

// GET /api/admin/stations
router.get('/stations', async (req, res, next) => {
  try {
    const { status, page = 1, limit = 50, incomplete } = req.query;
    const parsedPage = parseInt(page, 10) || 1;
    const parsedLimit = Math.min(parseInt(limit, 10) || 50, MAX_STATIONS_LIMIT);

    const filter = status ? { status } : {};
    if (incomplete === 'true') {
      Object.assign(filter, INCOMPLETE_ADDRESS_FILTER);
    }
    const total = await Station.countDocuments(filter);

    const stations = await Station.find(filter)
      .skip((parsedPage - 1) * parsedLimit)
      .limit(parsedLimit)
      .sort({ createdAt: -1 })
      .lean();

    return res.json({
      stations,
      total,
      page: parsedPage,
      pages: Math.ceil(total / parsedLimit),
    });
  } catch (err) {
    return next(err);
  }
});

// GET /api/admin/stations/incomplete
router.get('/stations/incomplete', async (req, res, next) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const parsedPage = toPositiveInt(page, 1);
    const parsedLimit = Math.min(toPositiveInt(limit, 50), MAX_STATIONS_LIMIT);
    const skip = (parsedPage - 1) * parsedLimit;

    const total = await Station.countDocuments(INCOMPLETE_ADDRESS_FILTER);
    const stations = await Station.find(INCOMPLETE_ADDRESS_FILTER)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parsedLimit)
      .lean();

    return res.json({
      stations,
      total,
      page: parsedPage,
      pages: Math.ceil(total / parsedLimit) || 1,
      limit: parsedLimit,
    });
  } catch (err) {
    return next(err);
  }
});

// GET /api/admin/stations/incomplete/summary
router.get('/stations/incomplete/summary', async (req, res, next) => {
  try {
    const [totalStations, incompleteTotal, incompleteByStatus, incompleteBySource, withPlaceId] =
      await Promise.all([
        Station.countDocuments({}),
        Station.countDocuments(INCOMPLETE_ADDRESS_FILTER),
        Station.aggregate([
          { $match: INCOMPLETE_ADDRESS_FILTER },
          { $group: { _id: '$status', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ]),
        Station.aggregate([
          { $match: INCOMPLETE_ADDRESS_FILTER },
          { $group: { _id: '$dataSource', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ]),
        Station.countDocuments({
          ...INCOMPLETE_ADDRESS_FILTER,
          placeId: { $exists: true, $type: 'string', $ne: '' },
        }),
      ]);

    const incompleteRatePct =
      totalStations > 0 ? Number(((incompleteTotal / totalStations) * 100).toFixed(2)) : 0;

    return res.json({
      totalStations,
      incompleteTotal,
      incompleteRatePct,
      withPlaceId,
      withoutPlaceId: Math.max(0, incompleteTotal - withPlaceId),
      byStatus: incompleteByStatus.map((item) => ({ status: item._id || 'UNKNOWN', count: item.count })),
      byDataSource: incompleteBySource.map((item) => ({ source: item._id || 'UNKNOWN', count: item.count })),
    });
  } catch (err) {
    return next(err);
  }
});

// POST /api/admin/stations/incomplete/autofix
router.post('/stations/incomplete/autofix', async (req, res, next) => {
  try {
    const dryRun = req.body?.dryRun !== false;
    const onlyWithPlaceId = req.body?.onlyWithPlaceId !== false;
    const state =
      typeof req.body?.state === 'string' && req.body.state.trim()
        ? req.body.state.trim().toUpperCase().slice(0, 2)
        : null;
    const limit = Math.min(toPositiveInt(req.body?.limit, 200), MAX_AUTOFIX_LIMIT);

    const baseFilter = {
      ...INCOMPLETE_ADDRESS_FILTER,
      ...(state ? { 'address.state': state } : {}),
      ...(onlyWithPlaceId ? { placeId: { $exists: true, $type: 'string', $ne: '' } } : {}),
    };

    const totalCandidates = await Station.countDocuments(baseFilter);
    const candidates = await Station.find(baseFilter).sort({ createdAt: -1 }).limit(limit).lean();

    if (!process.env.GOOGLE_PLACES_API_KEY) {
      if (dryRun) {
        return res.json({
          mode: 'DRY_RUN',
          totalCandidates,
          scanned: candidates.length,
          fixed: 0,
          skippedNoPlaceId: candidates.filter((item) => !item.placeId).length,
          skippedNoDetails: 0,
          skippedNoAddress: 0,
          errors: 0,
          remainingIncomplete: await Station.countDocuments({
            ...INCOMPLETE_ADDRESS_FILTER,
            ...(state ? { 'address.state': state } : {}),
          }),
          note: 'GOOGLE_PLACES_API_KEY missing. Dry-run executed without Places enrichment.',
        });
      }

      return res.status(503).json({
        error: 'GOOGLE_PLACES_API_KEY is required to execute autofix',
      });
    }

    let scanned = 0;
    let fixed = 0;
    let skippedNoPlaceId = 0;
    let skippedNoDetails = 0;
    let skippedNoAddress = 0;
    let errors = 0;
    const sample = [];

    for (const station of candidates) {
      scanned += 1;

      if (!station.placeId) {
        skippedNoPlaceId += 1;
        continue;
      }

      let details = null;
      try {
        details = await placesAPI.getPlaceDetails(station.placeId);
      } catch (error) {
        errors += 1;
        await sleep(AUTOFIX_DELAY_MS);
        continue;
      }

      if (!details) {
        skippedNoDetails += 1;
        await sleep(AUTOFIX_DELAY_MS);
        continue;
      }

      const parsedAddress = extractAddressFromPlaceDetails(details);
      const nextAddress = buildAddressUpdate(station, parsedAddress);

      if (!nextAddress) {
        skippedNoAddress += 1;
        await sleep(AUTOFIX_DELAY_MS);
        continue;
      }

      if (dryRun) {
        fixed += 1;
        if (sample.length < 25) {
          sample.push({
            stationId: station._id.toString(),
            name: station.name,
            previousAddress: station.address,
            nextAddress,
          });
        }
        await sleep(AUTOFIX_DELAY_MS);
        continue;
      }

      const result = await Station.updateOne(
        { _id: station._id },
        {
          $set: {
            address: nextAddress,
          },
        },
        { runValidators: true }
      );

      if (result.matchedCount > 0) {
        fixed += 1;
        await scheduleStationCacheInvalidation({
          reason: 'ADMIN_STATION_AUTOFIX_ADDRESS',
          stationId: station._id.toString(),
        });
      }

      if (sample.length < 25) {
        sample.push({
          stationId: station._id.toString(),
          name: station.name,
          nextAddress,
        });
      }

      await sleep(AUTOFIX_DELAY_MS);
    }

    const remainingIncomplete = await Station.countDocuments({
      ...INCOMPLETE_ADDRESS_FILTER,
      ...(state ? { 'address.state': state } : {}),
    });

    return res.json({
      mode: dryRun ? 'DRY_RUN' : 'EXECUTE',
      totalCandidates,
      scanned,
      fixed,
      skippedNoPlaceId,
      skippedNoDetails,
      skippedNoAddress,
      errors,
      remainingIncomplete,
      sample,
    });
  } catch (err) {
    return next(err);
  }
});

// PATCH /api/admin/stations/:id/verify
router.patch('/stations/:id/verify', validateObjectIdParam('id'), async (req, res, next) => {
  try {
    const { status, claimedBy } = req.body;
    const valid = ['UNCLAIMED', 'CLAIMED', 'VERIFIED'];

    if (!valid.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    if (status === 'VERIFIED' && !claimedBy) {
      return res.status(400).json({ error: 'claimedBy is required for VERIFIED status' });
    }
    if (claimedBy && !mongoose.Types.ObjectId.isValid(claimedBy)) {
      return res.status(400).json({ error: 'Invalid claimedBy' });
    }

    const update = { status };
    if (status === 'VERIFIED') {
      update.claimedBy = claimedBy;
      update.claimedAt = new Date();
    }
    const station = await Station.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!station) return res.status(404).json({ error: 'Station not found' });
    await scheduleStationCacheInvalidation({
      reason: 'ADMIN_STATION_STATUS_UPDATED',
      stationId: station._id.toString(),
    });

    return res.json({ station });
  } catch (err) {
    return next(err);
  }
});

// PATCH /api/admin/stations/:id/address
router.patch('/stations/:id/address', validateObjectIdParam('id'), async (req, res, next) => {
  try {
    const address = normalizeAddress(req.body?.address);
    if (!address.street || !address.city) {
      return res.status(400).json({ error: 'address.street and address.city are required' });
    }

    const station = await Station.findByIdAndUpdate(
      req.params.id,
      { $set: { address } },
      { new: true, runValidators: true }
    );
    if (!station) return res.status(404).json({ error: 'Station not found' });

    await scheduleStationCacheInvalidation({
      reason: 'ADMIN_STATION_ADDRESS_UPDATED',
      stationId: station._id.toString(),
    });

    return res.json({ station });
  } catch (err) {
    return next(err);
  }
});

// POST /api/admin/seed
router.post('/seed', async (req, res) => {
  if (!process.env.GOOGLE_PLACES_API_KEY) {
    return res.status(503).json({
      error: 'GOOGLE_PLACES_API_KEY is not configured. Seed endpoint requires a valid API key.',
    });
  }

  const { dryRun = false, stepKm = 50, bounds } = req.body;

  if (dryRun) {
    // Dry-run: compute grid scan count without hitting Places API
    const defaultBounds = bounds || { west: -84.8, south: 38.4, east: -80.5, north: 42.3 };
    const lngRange = Math.abs(defaultBounds.east - defaultBounds.west);
    const latRange = Math.abs(defaultBounds.north - defaultBounds.south);
    const kmPerDeg = 111;
    const cols = Math.ceil((lngRange * kmPerDeg) / stepKm);
    const rows = Math.ceil((latRange * kmPerDeg) / stepKm);
    const scannedPoints = cols * rows;

    return res.json({
      mode: 'DRY_RUN',
      scannedPoints,
      discoveredPlaces: 0,
      wouldInsert: 0,
      stepKm,
      bounds: defaultBounds,
    });
  }

  // Full seed — not yet implemented
  return res.status(501).json({
    error: 'Full seed not yet implemented. Use scripts/seedOhio.js CLI.',
  });
});


module.exports = router;
