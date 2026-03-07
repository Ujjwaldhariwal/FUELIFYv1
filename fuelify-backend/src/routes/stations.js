// fuelify-backend/src/routes/stations.js
const express = require('express');

const router = express.Router();
const Station = require('../models/Station');
const UserReport = require('../models/UserReport');
const PriceHistory = require('../models/PriceHistory');
const { reportLimiter } = require('../middleware/rateLimit');
const { validateObjectIdParam } = require('../middleware/validateObjectId');
const {
  getCachedStations,
  setCachedStations,
  scheduleStationCacheInvalidation,
} = require('../services/stationCache');
const { scoreStationRisk } = require('../services/stationRiskScorer');

const VALID_FUELS = ['regular', 'midgrade', 'premium', 'diesel', 'e85'];
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const DEFAULT_RADIUS_KM = 25;
const MAX_LIMIT = 500;
const DEFAULT_CLUSTER_LIMIT = 300;
const MAX_CLUSTER_LIMIT = 1000;

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const toPositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const parseBBox = (rawBbox) => {
  if (typeof rawBbox !== 'string') return null;
  const parts = rawBbox.split(',').map((value) => Number(value.trim()));
  if (parts.length !== 4 || parts.some((value) => !Number.isFinite(value))) return null;
  const [west, south, east, north] = parts;
  if (west >= east || south >= north) return null;
  if (west < -180 || east > 180 || south < -90 || north > 90) return null;
  return { west, south, east, north };
};

const getClusterStepDegrees = (zoom) => {
  if (!Number.isFinite(zoom)) return 0.18;
  if (zoom >= 12) return 0.035;
  if (zoom >= 11) return 0.06;
  if (zoom >= 10) return 0.1;
  if (zoom >= 9) return 0.18;
  if (zoom >= 8) return 0.32;
  return 0.6;
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
    const bbox = parseBBox(req.query.bbox);
    const zoom = toNumber(req.query.zoom);
    const fuel = typeof req.query.fuel === 'string' ? req.query.fuel : null;
    const page = toPositiveInt(req.query.page, DEFAULT_PAGE);
    const limit = Math.min(toPositiveInt(req.query.limit, DEFAULT_LIMIT), MAX_LIMIT);
    const skip = (page - 1) * limit;

    if (fuel && !VALID_FUELS.includes(fuel)) {
      return res.status(400).json({ error: 'Invalid fuel type' });
    }
    if (req.query.bbox && !bbox) {
      return res.status(400).json({ error: 'Invalid bbox. Use west,south,east,north' });
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
    const hasBbox = bbox !== null;
    const queryMode = hasBbox ? 'bbox' : hasLocation ? 'near' : 'state';
    const cacheParams = {
      lat,
      lng,
      radiusKm,
      fuel,
      page,
      limit,
      state: hasLocation || hasBbox ? null : typeof req.query.state === 'string' ? req.query.state.toUpperCase() : 'OH',
      queryMode,
      bboxWest: bbox?.west ?? null,
      bboxSouth: bbox?.south ?? null,
      bboxEast: bbox?.east ?? null,
      bboxNorth: bbox?.north ?? null,
      zoom,
    };
    const cached = await getCachedStations(cacheParams);
    if (cached) return res.json(cached);

    let stations = [];
    let total = 0;

    if (hasBbox) {
      const filter = {
        coordinates: {
          $geoWithin: {
            $box: [
              [bbox.west, bbox.south],
              [bbox.east, bbox.north],
            ],
          },
        },
      };
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
    } else if (hasLocation) {
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
      queryMode,
    };
    await setCachedStations(cacheParams, payload);
    return res.json(payload);
  } catch (err) {
    return next(err);
  }
});

// GET /api/stations/clusters?bbox=west,south,east,north&zoom=9&fuel=regular&limit=300
router.get('/clusters', async (req, res, next) => {
  try {
    const bbox = parseBBox(req.query.bbox);
    if (!bbox) {
      return res.status(400).json({ error: 'bbox is required. Use west,south,east,north' });
    }

    const zoom = toNumber(req.query.zoom) ?? 9;
    const fuel = typeof req.query.fuel === 'string' ? req.query.fuel : null;
    const limit = Math.min(toPositiveInt(req.query.limit, DEFAULT_CLUSTER_LIMIT), MAX_CLUSTER_LIMIT);

    if (fuel && !VALID_FUELS.includes(fuel)) {
      return res.status(400).json({ error: 'Invalid fuel type' });
    }

    const stepDegrees = getClusterStepDegrees(zoom);
    const cacheParams = {
      queryMode: 'bbox_cluster',
      bboxWest: bbox.west,
      bboxSouth: bbox.south,
      bboxEast: bbox.east,
      bboxNorth: bbox.north,
      zoom,
      fuel,
      page: 1,
      limit,
      state: null,
      lat: null,
      lng: null,
      radiusKm: null,
    };
    const cached = await getCachedStations(cacheParams);
    if (cached) return res.json(cached);

    const fuelPath = fuel ? `$prices.${fuel}` : '$prices.regular';
    const matchStage = {
      coordinates: {
        $geoWithin: {
          $box: [
            [bbox.west, bbox.south],
            [bbox.east, bbox.north],
          ],
        },
      },
    };

    const aggregate = await Station.aggregate([
      { $match: matchStage },
      {
        $project: {
          _id: 1,
          name: 1,
          brand: 1,
          status: 1,
          lat: { $arrayElemAt: ['$coordinates.coordinates', 1] },
          lng: { $arrayElemAt: ['$coordinates.coordinates', 0] },
          fuelPrice: fuelPath,
        },
      },
      {
        $addFields: {
          latBucket: { $floor: { $divide: ['$lat', stepDegrees] } },
          lngBucket: { $floor: { $divide: ['$lng', stepDegrees] } },
        },
      },
      {
        $group: {
          _id: { latBucket: '$latBucket', lngBucket: '$lngBucket' },
          count: { $sum: 1 },
          minPrice: { $min: '$fuelPrice' },
          lat: { $avg: '$lat' },
          lng: { $avg: '$lng' },
          sampleStation: {
            $first: {
              _id: '$_id',
              name: '$name',
              brand: '$brand',
              status: '$status',
            },
          },
        },
      },
      { $sort: { count: -1 } },
      {
        $facet: {
          clusters: [{ $limit: limit }],
          meta: [{ $count: 'totalClusters' }],
          totals: [{ $group: { _id: null, totalStations: { $sum: '$count' } } }],
        },
      },
    ]);

    const facet = aggregate[0] || { clusters: [], meta: [], totals: [] };
    const totalClusters = facet.meta[0]?.totalClusters || 0;
    const totalStations = facet.totals[0]?.totalStations || 0;
    const clusters = (facet.clusters || []).map((cluster) => ({
      clusterId: `${cluster._id.latBucket}:${cluster._id.lngBucket}`,
      center: { lat: cluster.lat, lng: cluster.lng },
      count: cluster.count,
      minPrice: Number.isFinite(cluster.minPrice) ? Number(Number(cluster.minPrice).toFixed(3)) : null,
      sampleStation: cluster.sampleStation,
    }));

    const payload = {
      queryMode: 'bbox_cluster',
      bbox,
      zoom,
      stepDegrees,
      fuel,
      limit,
      totalClusters,
      totalStations,
      truncated: clusters.length < totalClusters,
      clusters,
    };
    await setCachedStations(cacheParams, payload);
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
      await scheduleStationCacheInvalidation({
        reason: 'STATION_REPORTED',
        stationId: stationDoc._id.toString(),
      });
    }

    return res.status(201).json({ success: true, reportId: report._id });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
