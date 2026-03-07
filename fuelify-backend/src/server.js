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
const errorHandler = require('./middleware/errorHandler');
const { requestContext } = require('./middleware/requestContext');
const { apiLimiter } = require('./middleware/rateLimit');
const { startRiskMonitor, stopRiskMonitor } = require('./services/riskMonitor');
const { initializeStationCache, closeStationCache, getStationCacheProvider } = require('./services/stationCache');

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

  // Rate limiting
  app.use('/api', apiLimiter);

  // Routes
  app.use('/api/stations', stationsRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/dashboard', dashboardRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api/claims', claimsRouter);

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
  await initializeStationCache();
  const PORT = process.env.PORT || 5000;
  if (process.env.NODE_ENV !== 'test' && process.env.ENABLE_RISK_MONITOR !== 'false') {
    startRiskMonitor();
  }
  return app.listen(PORT, () =>
    console.log(`[Server] Running on port ${PORT} (station cache: ${getStationCacheProvider()})`)
  );
};

if (require.main === module) {
  startServer();
}

module.exports = { app, createApp, connectDB, startServer, stopRiskMonitor, closeStationCache };
