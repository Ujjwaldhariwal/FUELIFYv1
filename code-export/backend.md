# Fuelify — Backend Source Snapshot
> Generated: 2026-03-06T17:34:52.229Z
> Files: 17


────────────────────────────────────────────────────────────────────────────────
### fuelify-backend/src/server.js
```javascript
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
const errorHandler = require('./middleware/errorHandler');
const { apiLimiter } = require('./middleware/rateLimit');

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

  // Rate limiting
  app.use('/api', apiLimiter);

  // Routes
  app.use('/api/stations', stationsRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/dashboard', dashboardRouter);
  app.use('/api/admin', adminRouter);

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
  const PORT = process.env.PORT || 5000;
  return app.listen(PORT, () => console.log(`[Server] Running on port ${PORT}`));
};

if (require.main === module) {
  startServer();
}

module.exports = { app, createApp, connectDB, startServer };
```

────────────────────────────────────────────────────────────────────────────────
### fuelify-backend/src/middleware/auth.js
```javascript
// fuelify-backend/src/middleware/auth.js
const jwt = require('jsonwebtoken');
const Owner = require('../models/Owner');

// Middleware: require valid JWT (any verified owner)
const requireAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const owner = await Owner.findById(decoded.id).select('-passwordHash -verificationOtp');

    if (!owner) return res.status(401).json({ error: 'Owner not found' });
    if (!owner.isVerified) return res.status(403).json({ error: 'Account not verified' });

    req.owner = owner;
    return next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

// Middleware: require ADMIN role (checks role field AND admin secret header as fallback)
const requireAdmin = async (req, res, next) => {
  const adminKey = req.headers['x-admin-key'];
  if (adminKey && adminKey === process.env.ADMIN_SECRET_KEY) {
    req.isAdmin = true;
    return next();
  }

  if (!req.owner || req.owner.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  return next();
};

module.exports = { requireAuth, requireAdmin };
```

────────────────────────────────────────────────────────────────────────────────
### fuelify-backend/src/middleware/errorHandler.js
```javascript
// fuelify-backend/src/middleware/errorHandler.js
// Global error handler - must be last middleware registered in server.js
const errorHandler = (err, req, res, next) => {
  console.error('[ERROR]', err.message, err.stack);

  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

module.exports = errorHandler;
```

────────────────────────────────────────────────────────────────────────────────
### fuelify-backend/src/middleware/rateLimit.js
```javascript
// fuelify-backend/src/middleware/rateLimit.js
const rateLimit = require('express-rate-limit');

// OTP endpoint: max 5 requests per phone per 15 minutes
const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  keyGenerator: (req) => req.body.phone || req.ip,
  message: { error: 'Too many OTP requests. Please wait 15 minutes.' },
});

// General public API: 100 req/min per IP
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: { error: 'Too many requests from this IP.' },
});

// Report endpoint: 10 reports per IP per hour
const reportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: { error: 'Too many reports from this IP.' },
});

module.exports = { otpLimiter, apiLimiter, reportLimiter };
```

────────────────────────────────────────────────────────────────────────────────
### fuelify-backend/src/models/Station.js
```javascript
// fuelify-backend/src/models/Station.js
const mongoose = require('mongoose');

const PricesSchema = new mongoose.Schema(
  {
    regular: { type: Number, default: null },
    midgrade: { type: Number, default: null },
    premium: { type: Number, default: null },
    diesel: { type: Number, default: null },
    e85: { type: Number, default: null },
    lastUpdated: { type: Date, default: null },
    updatedBy: { type: String, enum: ['OWNER', 'USER', 'AI'], default: null },
  },
  { _id: false }
);

const AddressSchema = new mongoose.Schema(
  {
    street:  { type: String, default: null },
    city:    { type: String, default: null },
    state:   { type: String, required: true, default: 'OH' },
    zip:     { type: String, default: null },
    country: { type: String, required: true, default: 'US' },
  },
  { _id: false }
);

const CoordinatesSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: {
      type: [Number],
      required: true,
      validate: {
        validator: (value) => Array.isArray(value) && value.length === 2,
        message: 'coordinates must be [longitude, latitude]',
      },
    },
  },
  { _id: false }
);

const ServicesSchema = new mongoose.Schema(
  {
    carWash:   { type: Boolean, default: false },
    airPump:   { type: Boolean, default: false },
    atm:       { type: Boolean, default: false },
    restrooms: { type: Boolean, default: false },
    convenience: { type: Boolean, default: false },
    diesel:    { type: Boolean, default: false },
    evCharging:{ type: Boolean, default: false },
  },
  { _id: false }
);

const StationSchema = new mongoose.Schema(
  {
    osmId:   { type: String, default: null },
    placeId: { type: String, default: null },
    slug:    { type: String, required: true },
    name:    { type: String, required: true },
    brand: {
      type: String,
      enum: [
        'marathon', 'shell', 'bp', 'exxon', 'chevron',
        'arco', 'speedway', 'sunoco', 'citgo', 'gulf',
        'valero', 'costco', 'wawa', 'sheetz', 'caseys',
        'pilot', 'loves', 'ta', 'circle_k', 'kwik_trip',
        'texaco', '76', 'phillips66', 'conoco', 'petro',
        'thorntons', 'racetrac', 'holiday', 'maverik',
        'sinclair', 'cenex', 'quiktrip', 'bucees',
        'independent', 'default',
      ],
      default: 'default',
    },
    address:     { type: AddressSchema, required: true },
    coordinates: { type: CoordinatesSchema, required: true },
    phone:   { type: String, default: null },
    website: { type: String, default: null },
    hours:   { type: String, default: null },
    status: {
      type: String,
      enum: ['UNCLAIMED', 'CLAIMED', 'VERIFIED'],
      default: 'UNCLAIMED',
      index: true,
    },
    claimedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'Owner', default: null },
    claimedAt:  { type: Date, default: null },
    prices:     { type: PricesSchema, default: () => ({}) },
    confidenceScore: { type: Number, default: 0.5, min: 0, max: 1 },
    services:   { type: ServicesSchema, default: () => ({}) },
    metaDescription:  { type: String, default: '' },
    viewCount:        { type: Number, default: 0 },
    searchAppearances:{ type: Number, default: 0 },
    dataSource: {
      type: String,
      enum: ['OSM', 'GOOGLE_PLACES', 'MANUAL'],
      default: 'MANUAL',
    },
  },
  { timestamps: true }
);

// Indexes
StationSchema.index({ coordinates: '2dsphere' });
StationSchema.index({ 'address.state': 1, status: 1 });
StationSchema.index({ brand: 1 });
StationSchema.index({ slug: 1 },    { unique: true });
StationSchema.index({ placeId: 1 }, { unique: true, sparse: true });
StationSchema.index({ osmId: 1 },   { unique: true, sparse: true });
StationSchema.index({ name: 'text', 'address.city': 'text' });

module.exports = mongoose.model('Station', StationSchema);
```

────────────────────────────────────────────────────────────────────────────────
### fuelify-backend/src/models/Owner.js
```javascript
// fuelify-backend/src/models/Owner.js
const mongoose = require('mongoose');

const OwnerSchema = new mongoose.Schema(
  {
    stationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Station', required: true },
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    phone: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['OWNER', 'STAFF', 'ADMIN'], default: 'OWNER' },
    isVerified: { type: Boolean, default: false },
    verificationOtp: { type: String, default: null },
    verificationExpiry: { type: Date, default: null },
    lastLogin: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Owner', OwnerSchema);
```

────────────────────────────────────────────────────────────────────────────────
### fuelify-backend/src/models/PriceHistory.js
```javascript
// fuelify-backend/src/models/PriceHistory.js
const mongoose = require('mongoose');

const PriceEntrySchema = new mongoose.Schema(
  {
    regular: { type: Number, default: null },
    midgrade: { type: Number, default: null },
    premium: { type: Number, default: null },
    diesel: { type: Number, default: null },
    e85: { type: Number, default: null },
  },
  { _id: false }
);

const PriceHistorySchema = new mongoose.Schema(
  {
    stationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Station', required: true, index: true },
    submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Owner', default: null },
    sourceType: { type: String, enum: ['OWNER', 'USER', 'AI_OCR', 'FLEET'], required: true },
    prices: { type: PriceEntrySchema, required: true },
    confidenceScore: { type: Number, default: 0.8, min: 0, max: 1 },
    reportedAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

module.exports = mongoose.model('PriceHistory', PriceHistorySchema);
```

────────────────────────────────────────────────────────────────────────────────
### fuelify-backend/src/models/UserReport.js
```javascript
// fuelify-backend/src/models/UserReport.js
const mongoose = require('mongoose');

const UserReportSchema = new mongoose.Schema(
  {
    stationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Station', required: true, index: true },
    type: {
      type: String,
      enum: ['PRICE_UPDATE', 'WRONG_LOCATION', 'CLOSED', 'WRONG_INFO'],
      required: true,
    },
    data: { type: mongoose.Schema.Types.Mixed, default: {} },
    reporterIp: { type: String, required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('UserReport', UserReportSchema);
```

────────────────────────────────────────────────────────────────────────────────
### fuelify-backend/src/routes/stations.js
```javascript
// fuelify-backend/src/routes/stations.js
const express = require('express');

const router = express.Router();
const Station = require('../models/Station');
const UserReport = require('../models/UserReport');
const PriceHistory = require('../models/PriceHistory');
const { reportLimiter } = require('../middleware/rateLimit');

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

    return res.json({
      stations: stations.map(mapStationPayload),
      total,
      page,
      limit,
      pages: Math.ceil(total / limit) || 1,
    });
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
router.get('/id/:id', async (req, res, next) => {
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
router.post('/:stationId/report', reportLimiter, async (req, res, next) => {
  try {
    const { type, data } = req.body;
    const validTypes = ['PRICE_UPDATE', 'WRONG_LOCATION', 'CLOSED', 'WRONG_INFO'];

    if (!validTypes.includes(type)) {
      return res.status(400).json({ error: 'Invalid report type' });
    }

    const report = await UserReport.create({
      stationId: req.params.stationId,
      type,
      data: data || {},
      reporterIp: req.ip,
    });

    return res.status(201).json({ success: true, reportId: report._id });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
```

────────────────────────────────────────────────────────────────────────────────
### fuelify-backend/src/routes/auth.js
```javascript
// fuelify-backend/src/routes/auth.js
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const router = express.Router();
const Station = require('../models/Station');
const Owner = require('../models/Owner');
const { sendOtp, generateOtp, generateExpiry } = require('../services/otp');
const { sendWelcomeEmail } = require('../services/email');
const { otpLimiter } = require('../middleware/rateLimit');

// Helper: sign JWT (7 day expiry)
const signToken = (ownerId) => jwt.sign({ id: ownerId }, process.env.JWT_SECRET, { expiresIn: '7d' });

// POST /api/auth/claim/initiate
router.post('/claim/initiate', otpLimiter, async (req, res, next) => {
  try {
    const { stationId, phone } = req.body;
    if (!stationId || !phone) {
      return res.status(400).json({ error: 'stationId and phone required' });
    }

    const station = await Station.findById(stationId);
    if (!station) return res.status(404).json({ error: 'Station not found' });
    if (station.status === 'CLAIMED' || station.status === 'VERIFIED') {
      return res.status(409).json({ error: 'Station already claimed' });
    }

    const otp = generateOtp();
    const expiry = generateExpiry();

    await Owner.findOneAndUpdate(
      { phone },
      {
        phone,
        stationId,
        verificationOtp: await bcrypt.hash(otp, 8),
        verificationExpiry: expiry,
        isVerified: false,
        name: 'Pending',
        email: `pending_${phone}@fuelify.internal`,
        passwordHash: '',
        role: 'OWNER',
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    await sendOtp(phone, otp);
    return res.json({ success: true, message: 'OTP sent' });
  } catch (err) {
    return next(err);
  }
});

// POST /api/auth/claim/verify
router.post('/claim/verify', async (req, res, next) => {
  try {
    const { stationId, phone, otp, name, email, password } = req.body;

    if (!stationId || !phone || !otp || !name || !email || !password) {
      return res.status(400).json({ error: 'All fields required' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const owner = await Owner.findOne({ phone, stationId });
    if (!owner) return res.status(404).json({ error: 'No pending claim found for this phone' });

    if (!owner.verificationExpiry || new Date() > owner.verificationExpiry) {
      return res.status(410).json({ error: 'OTP expired. Please request a new one.' });
    }

    const otpMatch = await bcrypt.compare(otp, owner.verificationOtp);
    if (!otpMatch) return res.status(401).json({ error: 'Invalid OTP' });

    const passwordHash = await bcrypt.hash(password, 12);
    owner.name = name;
    owner.email = email;
    owner.passwordHash = passwordHash;
    owner.isVerified = true;
    owner.verificationOtp = null;
    owner.verificationExpiry = null;
    await owner.save();

    const station = await Station.findByIdAndUpdate(
      stationId,
      { status: 'VERIFIED', claimedBy: owner._id, claimedAt: new Date() },
      { new: true }
    );

    sendWelcomeEmail(email, name, station.name).catch(console.error);

    const token = signToken(owner._id);
    return res.json({ token, owner: { id: owner._id, name, email, role: owner.role }, station });
  } catch (err) {
    return next(err);
  }
});

// POST /api/auth/login
router.post('/login', async (req, res, next) => {
  try {
    const { identifier, password } = req.body;
    if (!identifier || !password) {
      return res.status(400).json({ error: 'Identifier and password required' });
    }

    const owner = await Owner.findOne({
      $or: [{ email: identifier.toLowerCase() }, { phone: identifier }],
    });

    if (!owner) return res.status(401).json({ error: 'Invalid credentials' });
    if (!owner.isVerified) return res.status(403).json({ error: 'Account not verified' });
    if (!owner.passwordHash) return res.status(403).json({ error: 'Account setup incomplete' });

    const valid = await bcrypt.compare(password, owner.passwordHash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    owner.lastLogin = new Date();
    await owner.save();

    const station = await Station.findById(owner.stationId).lean();
    const token = signToken(owner._id);

    return res.json({
      token,
      owner: { id: owner._id, name: owner.name, email: owner.email, role: owner.role },
      station,
    });
  } catch (err) {
    return next(err);
  }
});

// POST /api/auth/resend-otp
router.post('/resend-otp', otpLimiter, async (req, res, next) => {
  try {
    const { phone, stationId } = req.body;
    const owner = await Owner.findOne({ phone, stationId });

    if (!owner) return res.status(404).json({ error: 'No pending claim found' });

    const otp = generateOtp();
    owner.verificationOtp = await bcrypt.hash(otp, 8);
    owner.verificationExpiry = generateExpiry();
    await owner.save();

    await sendOtp(phone, otp);
    return res.json({ success: true, message: 'New OTP sent' });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
```

────────────────────────────────────────────────────────────────────────────────
### fuelify-backend/src/routes/dashboard.js
```javascript
// fuelify-backend/src/routes/dashboard.js
const express = require('express');

const router = express.Router();
const Station = require('../models/Station');
const PriceHistory = require('../models/PriceHistory');
const { requireAuth } = require('../middleware/auth');

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

    allowed.forEach((field) => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });

    const station = await Station.findByIdAndUpdate(
      req.owner.stationId,
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!station) return res.status(404).json({ error: 'Station not found' });
    return res.json({ station });
  } catch (err) {
    return next(err);
  }
});

// POST /api/dashboard/prices
router.post('/prices', async (req, res, next) => {
  try {
    const { regular, midgrade, premium, diesel, e85 } = req.body;
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
```

────────────────────────────────────────────────────────────────────────────────
### fuelify-backend/src/routes/admin.js
```javascript
// fuelify-backend/src/routes/admin.js
const express = require('express');

const router = express.Router();
const Station = require('../models/Station');
const { requireAuth, requireAdmin } = require('../middleware/auth');

// All admin routes require auth + admin role (or ADMIN_SECRET_KEY header)
router.use((req, res, next) => {
  const adminKey = req.headers['x-admin-key'];
  if (adminKey && adminKey === process.env.ADMIN_SECRET_KEY) {
    req.isAdmin = true;
    return next();
  }
  return requireAuth(req, res, next);
});
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
router.patch('/stations/:id/verify', async (req, res, next) => {
  try {
    const { status } = req.body;
    const valid = ['UNCLAIMED', 'CLAIMED', 'VERIFIED'];

    if (!valid.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const station = await Station.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!station) return res.status(404).json({ error: 'Station not found' });

    return res.json({ station });
  } catch (err) {
    return next(err);
  }
});

// POST /api/admin/seed
router.post('/seed', async (req, res) => {
  // PHASE 2 - stub
  // TODO: integrate with placesAPI.js grid search and Station.insertMany with deduplication
  return res.json({ message: 'Seed endpoint stub. Use scripts/seedOhio.js CLI for full seed.' });
});

module.exports = router;
```

────────────────────────────────────────────────────────────────────────────────
### fuelify-backend/src/services/email.js
```javascript
// fuelify-backend/src/services/email.js
const nodemailer = require('nodemailer');

const createTransport = () =>
  nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT, 10),
    secure: process.env.SMTP_PORT === '465',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });

const sendWelcomeEmail = async (to, ownerName, stationName) => {
  const transporter = createTransport();

  await transporter.sendMail({
    from: `"Fuelify" <${process.env.SMTP_USER}>`,
    to,
    subject: `You've claimed ${stationName} on Fuelify!`,
    html: `
      <h2>Welcome to Fuelify, ${ownerName}!</h2>
      <p>Your station <strong>${stationName}</strong> is now verified and live.</p>
      <p>Log in to start updating your fuel prices.</p>
      <a href="https://dashboard.fuelify.com">Go to Dashboard</a>
    `,
  });
};

const sendPriceUpdateAlert = async (to, stationName, prices) => {
  const transporter = createTransport();

  await transporter.sendMail({
    from: `"Fuelify" <${process.env.SMTP_USER}>`,
    to,
    subject: `Price update confirmed - ${stationName}`,
    html: `
      <h2>Prices Updated</h2>
      <p>Regular: $${prices.regular ?? 'N/A'}</p>
      <p>Midgrade: $${prices.midgrade ?? 'N/A'}</p>
      <p>Premium: $${prices.premium ?? 'N/A'}</p>
      <p>Diesel: $${prices.diesel ?? 'N/A'}</p>
    `,
  });
};

module.exports = { sendWelcomeEmail, sendPriceUpdateAlert };
```

────────────────────────────────────────────────────────────────────────────────
### fuelify-backend/src/services/otp.js
```javascript
// fuelify-backend/src/services/otp.js
const twilio = require('twilio');

// Returns: { success: true } or throws
const sendOtp = async (phone, otp) => {
  // Normalize phone to E.164 format - assume US if no country code
  const normalized = phone.startsWith('+') ? phone : `+1${phone.replace(/\D/g, '')}`;

  const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  await client.messages.create({
    body: `Your Fuelify verification code is: ${otp}. Expires in 10 minutes.`,
    from: process.env.TWILIO_PHONE_NUMBER,
    to: normalized,
  });

  return { success: true };
};

// Generates a 6-digit numeric OTP string
const generateOtp = () => Math.floor(100000 + Math.random() * 900000).toString();

// Returns OTP expiry date (10 minutes from now)
const generateExpiry = () => new Date(Date.now() + 10 * 60 * 1000);

module.exports = { sendOtp, generateOtp, generateExpiry };
```

────────────────────────────────────────────────────────────────────────────────
### fuelify-backend/src/services/placesAPI.js
```javascript
// fuelify-backend/src/services/placesAPI.js
const axios = require('axios');

const BASE_URL = 'https://maps.googleapis.com/maps/api/place';

// Search nearby gas stations for a given lat/lng within radius (meters)
const searchNearbyStations = async (lat, lng, radius = 50000) => {
  const url = `${BASE_URL}/nearbysearch/json`;
  const params = {
    location: `${lat},${lng}`,
    radius,
    type: 'gas_station',
    key: process.env.GOOGLE_PLACES_API_KEY,
  };

  const response = await axios.get(url, { params });
  return response.data.results || [];
};

// Get detailed info for a single place by placeId
const getPlaceDetails = async (placeId) => {
  const url = `${BASE_URL}/details/json`;
  const params = {
    place_id: placeId,
    fields: 'place_id,name,formatted_address,geometry,formatted_phone_number,website,opening_hours',
    key: process.env.GOOGLE_PLACES_API_KEY,
  };

  const response = await axios.get(url, { params });
  return response.data.result || null;
};

module.exports = { searchNearbyStations, getPlaceDetails };
```

────────────────────────────────────────────────────────────────────────────────
### fuelify-backend/src/services/slugify.js
```javascript
// fuelify-backend/src/services/slugify.js
// Generates a URL-safe slug from station name + city + state
const generateSlug = (name, street, city, state) => {
  const raw = `${name} ${street} ${city} ${state}`;
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
};

module.exports = { generateSlug };
```

────────────────────────────────────────────────────────────────────────────────
### fuelify-backend/src/scripts/seedOhio.js
```javascript
// fuelify-backend/src/scripts/seedOhio.js
require('dotenv').config();
const mongoose = require('mongoose');
const path     = require('path');
const fs       = require('fs');
const xml2js   = require('xml2js');
const Station  = require('../models/Station');

// ─── Brand Normalizer ─────────────────────────────────────
const BRAND_MAP = {
  'marathon': 'marathon', 'marathon petroleum': 'marathon',
  'shell': 'shell', 'bp': 'bp', 'british petroleum': 'bp',
  'speedway': 'speedway', 'sunoco': 'sunoco',
  'exxon': 'exxon', 'exxonmobil': 'exxon', 'mobil': 'exxon',
  'chevron': 'chevron', 'valero': 'valero', 'arco': 'arco',
  'circle k': 'circle_k', 'circlek': 'circle_k',
  "casey's": 'caseys', "casey's general store": 'caseys',
  'kwik trip': 'kwik_trip', 'kwik star': 'kwik_trip',
  'pilot': 'pilot', 'pilot flying j': 'pilot', 'flying j': 'pilot',
  "love's": 'loves', 'loves travel stops': 'loves',
  'wawa': 'wawa', 'sheetz': 'sheetz', 'costco': 'costco',
  'citgo': 'citgo', 'gulf': 'gulf', 'texaco': 'texaco',
  '76': '76', 'phillips 66': 'phillips66', 'conoco': 'conoco',
  'ta': 'ta', 'travel centers of america': 'ta', 'petro': 'petro',
  'thorntons': 'thorntons', 'racetrac': 'racetrac', 'racetrack': 'racetrac',
  'holiday': 'holiday', 'holiday stationstores': 'holiday',
  'maverik': 'maverik', 'sinclair': 'sinclair', 'cenex': 'cenex',
  'quiktrip': 'quiktrip', 'qt': 'quiktrip', "buc-ee's": 'bucees',
};

function normalizeBrand(raw) {
  if (!raw) return 'default';
  return BRAND_MAP[raw.toLowerCase().trim()] || 'default';
}

function generateSlug(name, city, state, osmId) {
  const base = `${name}-${city}-${state}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 70);
  return `${base}-${osmId}`;
}

// ─── Parse XML tags array → flat object ──────────────────
// xml2js gives tags as: [ { $: { k: 'name', v: 'Marathon' } } ]
function parseTags(rawTags) {
  const tags = {};
  if (!Array.isArray(rawTags)) return tags;
  for (const tag of rawTags) {
    if (tag.$ && tag.$.k) {
      tags[tag.$.k] = tag.$.v || '';
    }
  }
  return tags;
}

// ─── Map OSM node → Station document ─────────────────────
function mapToStation(node, defaultState) {
  const attrs = node.$ || {};

  // For nodes: lat/lon are direct attributes
  let lat = parseFloat(attrs.lat);
  let lng = parseFloat(attrs.lon);

  // For ways: use the center point from nd refs
  // OSM xapi ways don't have center — use first nd coordinate
  // We'll mark these and calculate centroid if needed
  if (isNaN(lat) || isNaN(lng) || !lat || !lng) return null;

  const tags    = parseTags(node.tag);
  const osmId   = String(attrs.id);
  const name    = tags.name || tags.brand || tags.operator || 'Gas Station';
  const city    = tags['addr:city']  || '';
  const state   = tags['addr:state'] || defaultState;
  const houseNo = tags['addr:housenumber'] || '';
  const street  = tags['addr:street'] || '';

  return {
    osmId,
    name,
    brand: normalizeBrand(tags.brand || tags.operator),
    slug:  generateSlug(name, city, state, osmId),
    coordinates: {
      type: 'Point',
      coordinates: [lng, lat],
    },
    address: {
      street:  [houseNo, street].filter(Boolean).join(' ') || null,
      city:    city  || null,
      state,
      zip:     tags['addr:postcode'] || null,
      country: 'US',
    },
    status:          'UNCLAIMED',
    dataSource:      'OSM',
    confidenceScore: 0.5,
    prices: {
      regular: null, midgrade: null, premium: null,
      diesel:  null, e85:      null,
      lastUpdated: null, updatedBy: null,
    },
    services: {
      diesel:      tags['fuel:diesel']    === 'yes',
      evCharging:  !!tags['socket:type2'],
      carWash:     tags['car_wash']       === 'yes',
      airPump:     tags['compressed_air'] === 'yes',
      atm:         tags['atm']            === 'yes',
      restrooms:   tags['toilets']        === 'yes',
      convenience: tags['shop']           === 'convenience',
    },
    phone:     null,
    website:   null,
    hours:     null,
    claimedBy: null,
    claimedAt: null,
  };
}


// ─── Main ─────────────────────────────────────────────────
async function seed() {
  const stateCode = (process.argv[2] || 'ohio').toLowerCase();
  const filePath  = path.join(__dirname, 'data', `${stateCode}.xml`);

  // ── Check file exists ──────────────────────────────────
  if (!fs.existsSync(filePath)) {
    console.error(`\n❌ File not found: ${filePath}`);
    console.error(`\n👉 Save your downloaded file as:`);
    console.error(`   src/scripts/data/${stateCode}.xml\n`);
    process.exit(1);
  }

  // ── Parse XML ──────────────────────────────────────────
  console.log(`📂 Reading: ${filePath}`);
  const xml    = fs.readFileSync(filePath, 'utf-8');
  console.log(`📄 File size: ${(xml.length / 1024 / 1024).toFixed(2)} MB`);
  console.log(`⏳ Parsing XML... (may take 10-20 seconds for large files)`);

  let parsed;
  try {
    parsed = await xml2js.parseStringPromise(xml, { explicitArray: true });
  } catch (err) {
    console.error(`❌ XML parse failed: ${err.message}`);
    process.exit(1);
  }

  const nodes = parsed?.osm?.node || [];
  console.log(`📦 Nodes found in XML: ${nodes.length}`);

  if (nodes.length === 0) {
    console.error('❌ No nodes found. Check the XML file is valid OSM data.');
    process.exit(1);
  }

  // ── Connect DB ─────────────────────────────────────────
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('🟢 MongoDB Connected\n');

  let seeded = 0, skipped = 0, errors = 0;
  let firstError = null;

  for (let i = 0; i < nodes.length; i++) {
    try {
      const doc = mapToStation(nodes[i], stateCode.toUpperCase());
      if (!doc) { errors++; continue; }

      // Direct MongoDB write — bypasses Mongoose validation
      const result = await Station.collection.updateOne(
        { osmId: doc.osmId },
        { $setOnInsert: doc },
        { upsert: true }
      );

      result.upsertedCount ? seeded++ : skipped++;

    } catch (err) {
      errors++;
      if (!firstError) {
        firstError = err.message;
        console.error(`\n⚠️  First error at row ${i}: ${err.message}`);
      }
    }

    if ((i + 1) % 500 === 0) {
      process.stdout.write(`⏳ ${i + 1}/${nodes.length} processed...\r`);
    }
  }

  const dbTotal = await Station.countDocuments();

  console.log(`\n${'═'.repeat(44)}`);
  console.log(`🏁  SEED COMPLETE — ${stateCode.toUpperCase()}`);
  console.log(`    XML nodes read:  ${nodes.length}`);
  console.log(`    New stations:    ${seeded}`);
  console.log(`    Already existed: ${skipped}`);
  console.log(`    No GPS / skip:   ${errors}`);
  console.log(`    Total in DB:     ${dbTotal}`);
  if (firstError) console.log(`\n    ⚠️  First error: ${firstError}`);
  console.log(`${'═'.repeat(44)}\n`);

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error('💥 Fatal:', err.message);
  process.exit(1);
});
```