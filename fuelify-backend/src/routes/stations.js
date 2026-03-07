// fuelify-backend/src/routes/stations.js
const express = require('express');

const router = express.Router();
const Station = require('../models/Station');
const UserReport = require('../models/UserReport');
const PriceHistory = require('../models/PriceHistory');
const { reportLimiter } = require('../middleware/rateLimit');
const { validateObjectIdParam } = require('../middleware/validateObjectId');
const { getCachedStations, setCachedStations } = require('../services/stationCache');
const { scoreStationRisk } = require('../services/stationRiskScorer');

const VALID_FUELS = ['regular', 'midgrade', 'premium', 'diesel', 'e85'];
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const DEFAULT_RADIUS_KM = 25;

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const toPositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const mapStationPayload = (station) => ({
  id: station._id.toString(),
  _id: station._id.toString(),
  name: station.name,
  brand: station.brand,
  slug: station.slug,
  coordinates: station.coordinates,
  address: station.address,
  prices: station.prices,
  status: station.status,
  services: station.services,
  lastUpdated: station.prices?.lastUpdated || null,
  ...(station.distanceMeters !== undefined && {
    distanceKm: Number((station.distanceMeters / 1000).toFixed(2)),
  }),
});

// GET /api/stations
router.get('/', async (req, res, next) => {
  try {
    const lat = toNumber(req.query.lat);
    const lng = toNumber(req.query.lng);
    const radiusKm = toNumber(req.query.radius) || DEFAULT_RADIUS_KM;
    const fuel = typeof req.query.fuel === 'string' ? req.query.fuel : null;
    const page = toPositiveInt(req.query.page, DEFAULT_PAGE);
    const limit = Math.min(toPositiveInt(req.query.limit, DEFAULT_LIMIT), 100);
    const skip = (page - 1) * limit;

    if (fuel && !VALID_FUELS.includes(fuel)) {
      return res.status(400).json({ error: 'Invalid fuel type' });
    }

    const projection = {
      _id: 1,
      name: 1,
      brand: 1,
      slug: 1,
      coordinates: 1,
      address: 1,
      prices: 1,
      status: 1,
      services: 1,
    };
    const hasLocation = lat !== null && lng !== null;
    const cacheParams = {
      lat,
      lng,
      radiusKm,
      fuel,
      page,
      limit,
      state: hasLocation ? null : typeof req.query.state === 'string' ? req.query.state.toUpperCase() : 'OH',
    };
    const cached = getCachedStations(cacheParams);
    if (cached) return res.json(cached);

    let stations = [];
    let total = 0;

    if (hasLocation) {
      const geoNear = {
        $geoNear: {
          near: { type: 'Point', coordinates: [lng, lat] },
          distanceField: 'distanceMeters',
          maxDistance: radiusKm * 1000,
          spherical: true,
        },
      };
      const pipeline = [
        geoNear,
      ];

      if (fuel) {
        pipeline.push({
          $addFields: {
            __fuelSort: { $ifNull: [`$prices.${fuel}`, Number.MAX_SAFE_INTEGER] },
          },
        });
        pipeline.push({ $sort: { __fuelSort: 1, distanceMeters: 1 } });
      } else {
        pipeline.push({ $sort: { distanceMeters: 1 } });
      }

      pipeline.push({ $skip: skip });
      pipeline.push({ $limit: limit });
      pipeline.push({ $project: projection });

      stations = await Station.aggregate(pipeline);
      const totalResult = await Station.aggregate([geoNear, { $count: 'total' }]);
      total = totalResult[0]?.total || 0;
    } else {
      const state = typeof req.query.state === 'string' ? req.query.state.toUpperCase() : 'OH';
      const filter = { 'address.state': state };
      total = await Station.countDocuments(filter);

      const pipeline = [{ $match: filter }];

      if (fuel) {
        pipeline.push({
          $addFields: {
            __fuelSort: { $ifNull: [`$prices.${fuel}`, Number.MAX_SAFE_INTEGER] },
          },
        });
        pipeline.push({ $sort: { __fuelSort: 1, name: 1 } });
      } else {
        pipeline.push({ $sort: { name: 1 } });
      }

      pipeline.push({ $skip: skip });
      pipeline.push({ $limit: limit });
      pipeline.push({ $project: projection });

      stations = await Station.aggregate(pipeline);
    }

    const topIds = stations.map((station) => station._id);
    if (topIds.length > 0) {
      Station.updateMany({ _id: { $in: topIds } }, { $inc: { searchAppearances: 1 } }).exec();
    }

    const payload = {
      stations: stations.map(mapStationPayload),
      total,
      page,
      limit,
      pages: Math.ceil(total / limit) || 1,
    };
    setCachedStations(cacheParams, payload);
    return res.json(payload);
  } catch (err) {
    return next(err);
  }
});

// GET /api/stations/search
router.get('/search', async (req, res, next) => {
  try {
    const { q, state } = req.query;

    if (!q || q.trim().length < 2) {
      return res.status(400).json({ error: 'Query must be at least 2 characters' });
    }

    const filter = {
      $text: { $search: q.trim() },
      ...(state ? { 'address.state': state.toUpperCase() } : {}),
    };

    const stations = await Station.find(filter)
      .select('name brand address coordinates status prices slug')
      .limit(15)
      .lean();

    return res.json({ stations });
  } catch (err) {
    return next(err);
  }
});

// Lookup station by MongoDB ObjectId (used by claim flow)
// NOTE: this route must be above /:slug to avoid route collisions.
router.get('/id/:id', validateObjectIdParam('id'), async (req, res, next) => {
  try {
    const station = await Station.findById(req.params.id).lean();
    if (!station) return res.status(404).json({ error: 'Station not found' });
    return res.json({ station });
  } catch (err) {
    return next(err);
  }
});

// GET /api/stations/:slug
router.get('/:slug', async (req, res, next) => {
  try {
    const station = await Station.findOneAndUpdate(
      { slug: req.params.slug },
      { $inc: { viewCount: 1 } },
      { new: true }
    ).lean();

    if (!station) return res.status(404).json({ error: 'Station not found' });

    const history = await PriceHistory.find({ stationId: station._id }).sort({ reportedAt: -1 }).limit(7).lean();

    return res.json({ station, priceHistory: history });
  } catch (err) {
    return next(err);
  }
});

// POST /api/stations/:stationId/AddressSchema 
router.post('/:stationId/report', validateObjectIdParam('stationId'), reportLimiter, async (req, res, next) => {
  try {
    const { type, data } = req.body;
    const validTypes = ['PRICE_UPDATE', 'WRONG_LOCATION', 'CLOSED', 'WRONG_INFO'];

    if (!validTypes.includes(type)) {
      return res.status(400).json({ error: 'Invalid report type' });
    }

    const station = await Station.findById(req.params.stationId).select('_id').lean();
    if (!station) {
      return res.status(404).json({ error: 'Station not found' });
    }

    const report = await UserReport.create({
      stationId: req.params.stationId,
      type,
      data: data || {},
      reporterIp: req.ip,
    });

    const stationDoc = await Station.findById(req.params.stationId);
    if (stationDoc) {
      const risk = await scoreStationRisk(stationDoc);
      stationDoc.riskScore = risk.riskScore;
      stationDoc.riskStatus = risk.riskStatus;
      stationDoc.riskReasons = risk.riskReasons;
      stationDoc.riskEvaluatedAt = risk.riskEvaluatedAt;
      stationDoc.blockedAt = risk.blockedAt;
      await stationDoc.save();
    }

    return res.status(201).json({ success: true, reportId: report._id });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
