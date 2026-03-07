const Station = require('../models/Station');
const { scoreStationRisk } = require('./stationRiskScorer');

let riskMonitorTimer = null;
let riskScanInFlight = false;

const toPositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const runRiskScanOnce = async () => {
  if (riskScanInFlight) return { scanned: 0, updated: 0, skipped: true };
  riskScanInFlight = true;

  try {
    const batchSize = toPositiveInt(process.env.RISK_RESCORER_BATCH_SIZE, 200);
    const staleHours = toPositiveInt(process.env.RISK_RESCORER_STALE_HOURS, 12);
    const staleBefore = new Date(Date.now() - staleHours * 60 * 60 * 1000);

    const stations = await Station.find({
      $or: [{ riskEvaluatedAt: null }, { riskEvaluatedAt: { $lt: staleBefore } }],
    })
      .select('_id status claimedBy riskStatus riskScore riskEvaluatedAt')
      .sort({ riskEvaluatedAt: 1, updatedAt: 1 })
      .limit(batchSize)
      .lean();

    if (stations.length === 0) return { scanned: 0, updated: 0, skipped: false };

    const updates = [];
    for (const station of stations) {
      const nextRisk = await scoreStationRisk(station);
      updates.push({
        updateOne: {
          filter: { _id: station._id },
          update: {
            $set: {
              riskScore: nextRisk.riskScore,
              riskStatus: nextRisk.riskStatus,
              riskReasons: nextRisk.riskReasons,
              riskEvaluatedAt: nextRisk.riskEvaluatedAt,
              blockedAt: nextRisk.blockedAt,
            },
          },
        },
      });
    }

    if (updates.length > 0) {
      await Station.bulkWrite(updates, { ordered: false });
    }

    return { scanned: stations.length, updated: updates.length, skipped: false };
  } finally {
    riskScanInFlight = false;
  }
};

const startRiskMonitor = () => {
  if (riskMonitorTimer) return;
  const intervalMinutes = toPositiveInt(process.env.RISK_RESCORER_INTERVAL_MINUTES, 10);
  const intervalMs = intervalMinutes * 60 * 1000;

  riskMonitorTimer = setInterval(() => {
    runRiskScanOnce()
      .then((result) => {
        if (!result.skipped && result.scanned > 0) {
          console.log(`[RiskMonitor] rescored ${result.updated}/${result.scanned} stations`);
        }
      })
      .catch((err) => {
        console.error('[RiskMonitor] scan failed:', err.message);
      });
  }, intervalMs);
  riskMonitorTimer.unref();
};

const stopRiskMonitor = () => {
  if (!riskMonitorTimer) return;
  clearInterval(riskMonitorTimer);
  riskMonitorTimer = null;
};

module.exports = { runRiskScanOnce, startRiskMonitor, stopRiskMonitor };
