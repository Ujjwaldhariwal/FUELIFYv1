// fuelify-backend/src/server.js
require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const stationsRouter = require('./routes/stations');
const authRouter = require('./routes/auth');
const dashboardRouter = require('./routes/dashboard');
const adminRouter = require('./routes/admin');
const claimsRouter = require('./routes/claims');
const pricesRouter = require('./routes/prices');
const errorHandler = require('./middleware/errorHandler');
const { requestContext } = require('./middleware/requestContext');
const { apiLimiter } = require('./middleware/rateLimit');
const { startRiskMonitor, stopRiskMonitor } = require('./services/riskMonitor');
const { initializeStationCache, closeStationCache, getStationCacheProvider } = require('./services/stationCache');
const { initializeDomainEvents, closeDomainEvents, getDomainEventProvider } = require('./services/domainEvents');
const {
  startCacheInvalidationWorker,
  stopCacheInvalidationWorker,
} = require('./workers/cacheInvalidationWorker');

const createApp = () => {
  const app = express();

  // Security and logging
  app.use(helmet());
  app.use(morgan('dev'));
  app.use(
    cors({
      origin: [
        'http://localhost:3000',
        'http://localhost:3001',
        'https://fuelify.com',
        'https://www.fuelify.com',
        'https://dashboard.fuelify.com',
      ],
      credentials: true,
    })
  );
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(requestContext);
  app.use((req, res, next) => {
    const startNs = process.hrtime.bigint();
    const originalEnd = res.end;

    res.end = function patchedEnd(...args) {
      const durationMs = Number(process.hrtime.bigint() - startNs) / 1e6;
      res.locals.responseTimeMs = durationMs;
      if (!res.headersSent && !res.getHeader('x-response-time-ms')) {
        res.setHeader('x-response-time-ms', durationMs.toFixed(1));
      }
      return originalEnd.apply(this, args);
    };

    res.on('finish', () => {
      if (!req.originalUrl.startsWith('/api') && req.originalUrl !== '/health') return;
      const durationMs = res.locals.responseTimeMs || 0;
      const stationCache = res.getHeader('x-station-cache');
      const priceCache = res.getHeader('x-price-cache');
      const cacheLabel = stationCache || priceCache ? ` cache=${stationCache || priceCache}` : '';
      console.log(
        `[RequestTiming] req=${req.requestId} ${req.method} ${req.originalUrl} status=${res.statusCode} time=${durationMs.toFixed(1)}ms${cacheLabel}`
      );
    });

    return next();
  });

  // Rate limiting
  app.use('/api', apiLimiter);

  // Routes
  app.use('/api/stations', stationsRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/dashboard', dashboardRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api/claims', claimsRouter);
  app.use('/api/prices', pricesRouter);

  // Health check
  app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));

  // Error handler (must be last)
  app.use(errorHandler);

  return app;
};

const app = createApp();

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log('[MongoDB] Connected successfully');
  } catch (err) {
    console.error('[MongoDB] Connection failed:', err.message);
    process.exit(1);
  }
};

const startServer = async () => {
  await connectDB();
  await initializeDomainEvents();
  await initializeStationCache();
  const PORT = process.env.PORT || 5000;

  if (process.env.STATION_CACHE_INVALIDATION_MODE === 'event') {
    startCacheInvalidationWorker();
  }
  if (process.env.NODE_ENV !== 'test' && process.env.ENABLE_RISK_MONITOR !== 'false') {
    startRiskMonitor();
  }
  return app.listen(PORT, () =>
    console.log(
      `[Server] Running on port ${PORT} (station cache: ${getStationCacheProvider()}, events: ${getDomainEventProvider()})`
    )
  );
};

if (require.main === module) {
  startServer();
}

module.exports = {
  app,
  createApp,
  connectDB,
  startServer,
  stopRiskMonitor,
  closeStationCache,
  closeDomainEvents,
  stopCacheInvalidationWorker,
};
