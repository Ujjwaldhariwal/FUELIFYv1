// fuelify-backend/src/routes/dashboard.js
const express = require('express');

const router = express.Router();
const Station = require('../models/Station');
const PriceHistory = require('../models/PriceHistory');
const { requireAuth } = require('../middleware/auth');
const { scheduleStationCacheInvalidation } = require('../services/stationCache');

// All routes in this file require JWT auth
router.use(requireAuth);

// GET /api/dashboard/station
router.get('/station', async (req, res, next) => {
  try {
    const station = await Station.findById(req.owner.stationId).lean();
    if (!station) return res.status(404).json({ error: 'Station not found' });
    return res.json({ station });
  } catch (err) {
    return next(err);
  }
});

// PATCH /api/dashboard/station
router.patch('/station', async (req, res, next) => {
  try {
    const allowed = ['name', 'address', 'phone', 'website', 'hours', 'services', 'brand'];
    const updates = {};
    const currentStation = await Station.findById(req.owner.stationId).select('riskStatus').lean();
    if (!currentStation) return res.status(404).json({ error: 'Station not found' });
    if (currentStation.riskStatus === 'blocked') {
      return res.status(403).json({ error: 'Station is blocked from profile updates' });
    }

    allowed.forEach((field) => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });

    const station = await Station.findByIdAndUpdate(
      req.owner.stationId,
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!station) return res.status(404).json({ error: 'Station not found' });
    await scheduleStationCacheInvalidation({
      reason: 'STATION_PROFILE_UPDATED',
      stationId: req.owner.stationId.toString(),
    });
    return res.json({ station });
  } catch (err) {
    return next(err);
  }
});

// POST /api/dashboard/prices
router.post('/prices', async (req, res, next) => {
  try {
    const { regular, midgrade, premium, diesel, e85 } = req.body;
    const currentStation = await Station.findById(req.owner.stationId).select('riskStatus').lean();
    if (!currentStation) return res.status(404).json({ error: 'Station not found' });
    if (currentStation.riskStatus === 'blocked') {
      return res.status(403).json({ error: 'Station is blocked from price updates' });
    }
    const submitted = { regular, midgrade, premium, diesel, e85 };

    const validKeys = Object.keys(submitted).filter(
      (key) => submitted[key] !== undefined && submitted[key] !== null
    );

    if (validKeys.length === 0) {
      return res.status(400).json({ error: 'At least one fuel price required' });
    }

    for (const key of validKeys) {
      const val = parseFloat(submitted[key]);
      if (Number.isNaN(val) || val <= 0 || val > 20) {
        return res
          .status(400)
          .json({ error: `Invalid price for ${key}: must be between $0.01 and $20.00` });
      }
      submitted[key] = parseFloat(val.toFixed(3));
    }

    const priceUpdate = {};
    validKeys.forEach((key) => {
      priceUpdate[`prices.${key}`] = submitted[key];
    });
    priceUpdate['prices.lastUpdated'] = new Date();
    priceUpdate['prices.updatedBy'] = 'OWNER';

    const station = await Station.findByIdAndUpdate(
      req.owner.stationId,
      { $set: priceUpdate },
      { new: true }
    );

    if (!station) return res.status(404).json({ error: 'Station not found' });

    await PriceHistory.create({
      stationId: req.owner.stationId,
      submittedBy: req.owner._id,
      sourceType: 'OWNER',
      prices: {
        regular: submitted.regular ?? null,
        midgrade: submitted.midgrade ?? null,
        premium: submitted.premium ?? null,
        diesel: submitted.diesel ?? null,
        e85: submitted.e85 ?? null,
      },
      confidenceScore: 1.0,
    });

    await scheduleStationCacheInvalidation({
      reason: 'STATION_PRICES_UPDATED',
      stationId: req.owner.stationId.toString(),
    });
    return res.json({ success: true, prices: station.prices });
  } catch (err) {
    return next(err);
  }
});

// GET /api/dashboard/price-history
router.get('/price-history', async (req, res, next) => {
  try {
    const history = await PriceHistory.find({ stationId: req.owner.stationId })
      .sort({ reportedAt: -1 })
      .limit(30)
      .populate('submittedBy', 'name role')
      .lean();

    return res.json({ history });
  } catch (err) {
    return next(err);
  }
});

// GET /api/dashboard/analytics
router.get('/analytics', async (req, res, next) => {
  try {
    const station = await Station.findById(req.owner.stationId)
      .select('viewCount searchAppearances prices coordinates address')
      .lean();

    if (!station) return res.status(404).json({ error: 'Station not found' });

    const radiusKm = 8;
    const [lng, lat] = station.coordinates?.coordinates || [];

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(422).json({ error: 'Station coordinates are invalid' });
    }

    let rankInArea = null;

    if (station.prices?.regular) {
      const cheaper = await Station.countDocuments({
        _id: { $ne: station._id },
        status: 'VERIFIED',
        'prices.regular': { $lt: station.prices.regular, $ne: null },
        coordinates: {
          $geoWithin: {
            $centerSphere: [[lng, lat], radiusKm / 6378.1],
          },
        },
      });
      rankInArea = cheaper + 1;
    }

    return res.json({
      viewCount: station.viewCount,
      searchAppearances: station.searchAppearances,
      lastPriceUpdate: station.prices?.lastUpdated || null,
      currentRegularPrice: station.prices?.regular || null,
      rankInArea,
    });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
