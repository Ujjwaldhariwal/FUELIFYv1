const express = require('express');
const mongoose = require('mongoose');

const Station = require('../models/Station');
const PriceReport = require('../models/PriceReport');
const { priceLimiter, confirmLimiter } = require('../middleware/rateLimit');

const router = express.Router();

const FUEL_TYPES = ['petrol', 'diesel', 'premium', 'cng', 'ev'];
const STALE_HOURS = 6;
const MAX_CONFIRM_COUNT = 50;
const LATEST_PRICE_TTL_MS = 30 * 1000;
const latestPricesCache = new Map();
const latestPricesInFlight = new Map();

const isPriceStale = (reportedAt, now = Date.now()) => {
  if (!reportedAt) return true;
  const reportedAtMs = new Date(reportedAt).getTime();
  if (!Number.isFinite(reportedAtMs)) return true;
  return now - reportedAtMs > STALE_HOURS * 60 * 60 * 1000;
};

const isValidFuelType = (fuelType) => FUEL_TYPES.includes(fuelType);

const isValidPriceValue = (value) => Number.isFinite(value) && value > 0 && value <= 999.99;

const buildEmptyPriceMap = () => ({
  petrol: null,
  diesel: null,
  premium: null,
  cng: null,
  ev: null,
});

const getCachedLatestPrices = (stationId) => {
  const entry = latestPricesCache.get(stationId);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    latestPricesCache.delete(stationId);
    return null;
  }
  return entry.payload;
};

const setCachedLatestPrices = (stationId, payload) => {
  latestPricesCache.set(stationId, {
    payload,
    expiresAt: Date.now() + LATEST_PRICE_TTL_MS,
  });
};

const invalidateLatestPriceCache = (stationId) => {
  latestPricesCache.delete(stationId);
  latestPricesInFlight.delete(stationId);
};

const applyConfirmation = (report, fingerprint) => {
  if (!report || !fingerprint) return { changed: false, confirmCount: report?.confirmCount || 0 };
  if (!Array.isArray(report.confirmedBy)) report.confirmedBy = [];
  if (report.confirmedBy.includes(fingerprint)) {
    return { changed: false, confirmCount: report.confirmCount || 0 };
  }
  if ((report.confirmCount || 0) >= MAX_CONFIRM_COUNT) {
    return { changed: false, capReached: true, confirmCount: report.confirmCount || 0 };
  }
  report.confirmedBy.push(fingerprint);
  report.confirmCount = (report.confirmCount || 0) + 1;
  return { changed: true, confirmCount: report.confirmCount };
};

const mapLatestPrice = (report) => ({
  price: report.price,
  reportedAt: report.reportedAt,
  isStale: isPriceStale(report.reportedAt),
  confirmCount: report.confirmCount || 0,
});

// POST /api/prices
router.post('/', priceLimiter, async (req, res, next) => {
  try {
    const { stationId, fuelType } = req.body;
    const parsedPrice = Number(req.body?.price);

    if (!mongoose.Types.ObjectId.isValid(stationId)) {
      return res.status(400).json({ code: 'INVALID_STATION_ID', error: 'Invalid stationId' });
    }
    if (!isValidFuelType(fuelType)) {
      return res.status(400).json({ code: 'INVALID_FUEL_TYPE', error: 'Invalid fuelType' });
    }
    if (!isValidPriceValue(parsedPrice)) {
      return res.status(400).json({ code: 'INVALID_PRICE', error: 'Invalid price' });
    }

    const station = await Station.findById(stationId).select('_id').lean();
    if (!station) {
      return res.status(404).json({ code: 'STATION_NOT_FOUND', error: 'Station not found' });
    }

    const report = await PriceReport.create({
      stationId,
      fuelType,
      price: Number(parsedPrice.toFixed(3)),
      reportedBy: req.ip || null,
    });
    invalidateLatestPriceCache(stationId.toString());

    return res.status(201).json({
      reportId: report._id.toString(),
      stationId: report.stationId.toString(),
      fuelType: report.fuelType,
      price: report.price,
      reportedAt: report.reportedAt,
    });
  } catch (err) {
    return next(err);
  }
});

// POST /api/prices/:reportId/confirm
router.post('/:reportId/confirm', confirmLimiter, async (req, res, next) => {
  try {
    const { reportId } = req.params;
    const fingerprint = String(req.body?.fingerprint || '').trim();

    if (!mongoose.Types.ObjectId.isValid(reportId)) {
      return res.status(400).json({ code: 'INVALID_REPORT_ID', error: 'Invalid reportId' });
    }
    if (!fingerprint || fingerprint.length > 64) {
      return res.status(400).json({ code: 'INVALID_FINGERPRINT', error: 'Invalid fingerprint' });
    }

    const report = await PriceReport.findById(reportId);
    if (!report) {
      return res.status(404).json({ code: 'REPORT_NOT_FOUND', error: 'Price report not found' });
    }

    const confirmation = applyConfirmation(report, fingerprint);
    if (confirmation.capReached) {
      return res.status(409).json({ code: 'CONFIRM_CAP_REACHED', error: 'Confirmation cap reached' });
    }

    if (confirmation.changed) {
      await report.save();
    }
    invalidateLatestPriceCache(report.stationId.toString());
    return res.status(200).json({ confirmCount: confirmation.confirmCount });
  } catch (err) {
    return next(err);
  }
});

// GET /api/prices/:stationId/latest
router.get('/:stationId/latest', async (req, res, next) => {
  try {
    const { stationId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(stationId)) {
      return res.status(400).json({ code: 'INVALID_STATION_ID', error: 'Invalid stationId' });
    }

    const cached = getCachedLatestPrices(stationId);
    if (cached) {
      res.setHeader('x-price-cache', 'hit');
      return res.status(200).json(cached);
    }

    const existingPromise = latestPricesInFlight.get(stationId);
    if (existingPromise) {
      const payload = await existingPromise;
      if (!payload) {
        return res.status(404).json({ code: 'STATION_NOT_FOUND', error: 'Station not found' });
      }
      res.setHeader('x-price-cache', 'deduped');
      return res.status(200).json(payload);
    }

    const loadPromise = (async () => {
      const stationExists = await Station.exists({ _id: stationId });
      if (!stationExists) return null;

      const stationObjectId = new mongoose.Types.ObjectId(stationId);
      const latestByFuel = await PriceReport.aggregate([
        { $match: { stationId: stationObjectId } },
        { $sort: { fuelType: 1, reportedAt: -1 } },
        { $group: { _id: '$fuelType', report: { $first: '$$ROOT' } } },
      ]);

      const prices = buildEmptyPriceMap();
      for (const entry of latestByFuel) {
        if (!isValidFuelType(entry._id) || !entry.report) continue;
        prices[entry._id] = mapLatestPrice(entry.report);
      }

      const payload = {
        stationId: stationId.toString(),
        prices,
      };
      setCachedLatestPrices(stationId, payload);
      return payload;
    })();

    latestPricesInFlight.set(stationId, loadPromise);

    const payload = await loadPromise;
    latestPricesInFlight.delete(stationId);

    if (!payload) {
      return res.status(404).json({ code: 'STATION_NOT_FOUND', error: 'Station not found' });
    }

    res.setHeader('x-price-cache', 'miss');
    return res.status(200).json(payload);
  } catch (err) {
    latestPricesInFlight.delete(req.params.stationId);
    return next(err);
  }
});

module.exports = router;
module.exports.FUEL_TYPES = FUEL_TYPES;
module.exports.STALE_HOURS = STALE_HOURS;
module.exports.isPriceStale = isPriceStale;
module.exports.isValidPriceValue = isValidPriceValue;
module.exports.applyConfirmation = applyConfirmation;
module.exports.buildEmptyPriceMap = buildEmptyPriceMap;
