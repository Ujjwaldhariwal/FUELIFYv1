// fuelify-backend/src/routes/admin.js
const express = require('express');

const router = express.Router();
const Station = require('../models/Station');
const mongoose = require('mongoose');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { validateObjectIdParam } = require('../middleware/validateObjectId');
const { scheduleStationCacheInvalidation } = require('../services/stationCache');

// All admin routes require auth + ADMIN role
router.use(requireAuth);
router.use(requireAdmin);

// GET /api/admin/stations
router.get('/stations', async (req, res, next) => {
  try {
    const { status, page = 1, limit = 50 } = req.query;
    const parsedPage = parseInt(page, 10) || 1;
    const parsedLimit = parseInt(limit, 10) || 50;

    const filter = status ? { status } : {};
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

// POST /api/admin/seed
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
