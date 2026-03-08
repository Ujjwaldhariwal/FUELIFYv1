//fuelify-backend/tests/integration/api.integration.test.js

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_1234567890';
process.env.ADMIN_SECRET_KEY = process.env.ADMIN_SECRET_KEY || 'test_admin_secret_1234567890';

require('dotenv').config();

const request = require('supertest');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { MongoMemoryServer } = require('mongodb-memory-server');

const { app } = require('../../src/server');
const Station = require('../../src/models/Station');
const Owner = require('../../src/models/Owner');
const PriceHistory = require('../../src/models/PriceHistory');
const Claim = require('../../src/models/Claim');
const PriceReport = require('../../src/models/PriceReport');
const placesAPI = require('../../src/services/placesAPI');

let mongoServer;
const TEST_DB_NAME = 'fuelify_integration_tests';

jest.setTimeout(120000);

const makeStation = async ({
  name,
  slug,
  regular,
  lat = 39.9612,
  lng = -82.9988,
  city = 'Columbus',
  status = 'VERIFIED',
  claimedBy = null,
}) => {
  return Station.create({
    slug,
    name,
    brand: 'marathon',
    address: {
      street: '205 W Front St',
      city,
      state: 'OH',
      zip: '43215',
      country: 'US',
    },
    coordinates: { type: 'Point', coordinates: [lng, lat] },
    phone: '+1-555-000-1111',
    website: 'https://fuelify.example',
    hours: 'Mon-Sun 6am-11pm',
    status,
    claimedBy,
    claimedAt: claimedBy ? new Date() : null,
    prices: {
      regular,
      midgrade: null,
      premium: null,
      diesel: null,
      e85: null,
      lastUpdated: new Date(),
      updatedBy: 'OWNER',
    },
    confidenceScore: 1,
    services: {
      carWash: true,
      airPump: true,
      atm: true,
      restrooms: true,
      convenience: true,
      diesel: true,
      evCharging: false,
    },
    metaDescription: 'Integration test station.',
    dataSource: 'MANUAL',
  });
};

const makeVerifiedOwner = async ({ stationId, email, phone, password = 'DevPass123!' }) => {
  const passwordHash = await bcrypt.hash(password, 12);
  return Owner.create({
    stationId,
    name: 'Integration Owner',
    email,
    phone,
    passwordHash,
    role: 'OWNER',
    isVerified: true,
    verificationOtp: null,
    verificationExpiry: null,
    lastLogin: null,
  });
};

const makePendingOwner = async ({
  stationId,
  email,
  phone,
  otp = '123456',
  name = 'Pending',
}) => {
  const verificationOtp = await bcrypt.hash(otp, 8);
  const passwordHash = await bcrypt.hash('PendingPass123!', 12);
  return Owner.create({
    stationId,
    name,
    email,
    phone,
    passwordHash,
    role: 'OWNER',
    isVerified: false,
    verificationOtp,
    verificationExpiry: new Date(Date.now() + 10 * 60 * 1000),
    lastLogin: null,
  });
};

const loginAsOwner = async ({ identifier, password = 'DevPass123!' }) => {
  const loginRes = await request(app).post('/api/auth/login').send({
    identifier,
    password,
  });
  expect(loginRes.status).toBe(200);
  expect(loginRes.body.token).toBeTruthy();
  return loginRes.body.token;
};

const makeAdminOwner = async () => {
  const passwordHash = await bcrypt.hash('AdminPass123!', 12);
  return Owner.create({
    stationId: new mongoose.Types.ObjectId(),
    name: 'Test Admin',
    email: 'admin.test@fuelify.local',
    phone: '+15550000099',
    passwordHash,
    role: 'ADMIN',
    isVerified: true,
  });
};

const signOwnerToken = (ownerId) => jwt.sign({ id: ownerId.toString() }, process.env.JWT_SECRET, { expiresIn: '7d' });


beforeAll(async () => {
  const externalUri = process.env.TEST_MONGODB_URI || process.env.MONGODB_URI;
  if (externalUri) {
    await mongoose.connect(externalUri, { dbName: TEST_DB_NAME, serverSelectionTimeoutMS: 15000 });
    return;
  }

  mongoServer = await MongoMemoryServer.create({
    instance: { dbName: TEST_DB_NAME },
  });
  await mongoose.connect(mongoServer.getUri(), { dbName: TEST_DB_NAME, serverSelectionTimeoutMS: 15000 });
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
});

beforeEach(async () => {
  jest.restoreAllMocks();
  await Promise.all([
    Station.deleteMany({}),
    Owner.deleteMany({}),
    PriceHistory.deleteMany({}),
    Claim.deleteMany({}),
    PriceReport.deleteMany({}),
  ]);
});

describe('Fuelify backend integration', () => {
  test('GET /health returns ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.timestamp).toBeDefined();
    expect(res.headers['x-request-id']).toBeTruthy();
  });

  test('GET /api/stations returns stations sorted by selected fuel price', async () => {
    const expensive = await makeStation({
      name: 'Expensive Station',
      slug: 'expensive-station-columbus-oh',
      regular: 3.799,
      lat: 39.9612,
      lng: -82.9988,
    });

    const cheaper = await makeStation({
      name: 'Cheaper Station',
      slug: 'cheaper-station-columbus-oh',
      regular: 3.199,
      lat: 39.969,
      lng: -82.99,
    });

    const res = await request(app)
      .get('/api/stations')
      .query({ lat: 39.9612, lng: -82.9988, fuel: 'regular', radius: 25, limit: 10 });

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(res.body.stations).toHaveLength(2);
    expect(res.body.stations[0]._id).toBe(cheaper._id.toString());
    expect(res.body.stations[1]._id).toBe(expensive._id.toString());
  });

  test('GET /api/stations supports bbox viewport mode', async () => {
    const inBounds = await makeStation({
      name: 'Viewport In Bounds',
      slug: 'viewport-in-bounds-columbus-oh',
      regular: 3.299,
      lat: 40.02,
      lng: -82.95,
    });
    await makeStation({
      name: 'Viewport Out Bounds',
      slug: 'viewport-out-bounds-columbus-oh',
      regular: 3.199,
      lat: 41.4,
      lng: -84.2,
    });

    const res = await request(app).get('/api/stations').query({
      bbox: '-83.20,39.80,-82.70,40.20',
      fuel: 'regular',
      limit: 200,
      zoom: 12,
    });

    expect(res.status).toBe(200);
    expect(res.body.queryMode).toBe('bbox');
    expect(res.body.total).toBe(1);
    expect(res.body.stations).toHaveLength(1);
    expect(res.body.stations[0]._id).toBe(inBounds._id.toString());
  });

  test('GET /api/stations/clusters returns aggregated viewport clusters', async () => {
    await makeStation({
      name: 'Cluster A One',
      slug: 'cluster-a-one-columbus-oh',
      regular: 3.099,
      lat: 40.001,
      lng: -82.901,
    });
    await makeStation({
      name: 'Cluster A Two',
      slug: 'cluster-a-two-columbus-oh',
      regular: 3.299,
      lat: 40.011,
      lng: -82.911,
    });
    await makeStation({
      name: 'Cluster B One',
      slug: 'cluster-b-one-columbus-oh',
      regular: 3.499,
      lat: 39.901,
      lng: -82.801,
    });

    const res = await request(app).get('/api/stations/clusters').query({
      bbox: '-83.20,39.80,-82.70,40.20',
      zoom: 9,
      fuel: 'regular',
      limit: 50,
    });

    expect(res.status).toBe(200);
    expect(res.body.queryMode).toBe('bbox_cluster');
    expect(res.body.totalStations).toBe(3);
    expect(res.body.totalClusters).toBeGreaterThanOrEqual(2);
    expect(Array.isArray(res.body.clusters)).toBe(true);
    expect(res.body.clusters.length).toBeGreaterThanOrEqual(2);
    expect(res.body.clusters[0].count).toBeGreaterThanOrEqual(1);
  });

  test('POST /api/auth/login returns token + owner + station for verified owner', async () => {
    const station = await makeStation({
      name: 'Login Station',
      slug: 'login-station-columbus-oh',
      regular: 3.499,
    });

    await makeVerifiedOwner({
      stationId: station._id,
      email: 'owner.login@fuelify.local',
      phone: '+15550002222',
      password: 'DevPass123!',
    });

    const res = await request(app).post('/api/auth/login').send({
      identifier: 'owner.login@fuelify.local',
      password: 'DevPass123!',
    });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    expect(res.body.owner.email).toBe('owner.login@fuelify.local');
    expect(res.body.station._id).toBe(station._id.toString());
  });

  test('POST /api/auth/claim/initiate returns 409 for an already verified owner and does not downgrade owner', async () => {
    const station = await makeStation({
      name: 'Claim Initiate Guard Station',
      slug: 'claim-initiate-guard-station-columbus-oh',
      regular: null,
      status: 'UNCLAIMED',
    });

    const owner = await makeVerifiedOwner({
      stationId: station._id,
      email: 'owner.claim.guard@fuelify.local',
      phone: '+15550009991',
      password: 'DevPass123!',
    });

    const res = await request(app).post('/api/auth/claim/initiate').send({
      stationId: station._id.toString(),
      phone: owner.phone,
    });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('Station already claimed and verified. Please log in instead.');

    const ownerAfter = await Owner.findById(owner._id).lean();
    expect(ownerAfter.isVerified).toBe(true);
  });

  test('POST /api/auth/claim/verify rejects invalid email format', async () => {
    const station = await makeStation({
      name: 'Claim Verify Email Station',
      slug: 'claim-verify-email-station-columbus-oh',
      regular: null,
      status: 'UNCLAIMED',
    });

    await makePendingOwner({
      stationId: station._id,
      email: 'pending.claim.verify@fuelify.local',
      phone: '+15550009992',
      otp: '123456',
    });

    const res = await request(app).post('/api/auth/claim/verify').send({
      stationId: station._id.toString(),
      phone: '+15550009992',
      otp: '123456',
      name: 'Invalid Email Owner',
      email: 'invalid-email',
      password: 'DevPass123!',
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid email format');
  });

  test('POST /api/dashboard/prices updates station prices and logs PriceHistory', async () => {
    const station = await makeStation({
      name: 'Dashboard Station',
      slug: 'dashboard-station-columbus-oh',
      regular: 3.499,
    });

    const owner = await makeVerifiedOwner({
      stationId: station._id,
      email: 'owner.dashboard@fuelify.local',
      phone: '+15550003333',
      password: 'DevPass123!',
    });

    const loginRes = await request(app).post('/api/auth/login').send({
      identifier: 'owner.dashboard@fuelify.local',
      password: 'DevPass123!',
    });
    expect(loginRes.status).toBe(200);

    const token = loginRes.body.token;
    const updateRes = await request(app)
      .post('/api/dashboard/prices')
      .set('Authorization', `Bearer ${token}`)
      .send({ regular: 3.111, midgrade: 3.555 });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.success).toBe(true);
    expect(updateRes.body.prices.regular).toBeCloseTo(3.111, 3);
    expect(updateRes.body.prices.midgrade).toBeCloseTo(3.555, 3);

    const stationAfter = await Station.findById(station._id).lean();
    expect(stationAfter.prices.updatedBy).toBe('OWNER');
    expect(stationAfter.prices.regular).toBeCloseTo(3.111, 3);

    const historyRes = await request(app)
      .get('/api/dashboard/price-history')
      .set('Authorization', `Bearer ${token}`);

    expect(historyRes.status).toBe(200);
    expect(historyRes.body.history.length).toBeGreaterThanOrEqual(1);
    expect(historyRes.body.history[0].sourceType).toBe('OWNER');
    expect(historyRes.body.history[0].stationId).toBe(station._id.toString());

    const historyDoc = await PriceHistory.findOne({ stationId: station._id }).lean();
    expect(historyDoc.submittedBy.toString()).toBe(owner._id.toString());
    expect(historyDoc.prices.regular).toBeCloseTo(3.111, 3);
  });

  test('POST /api/dashboard/prices rejects updates for non-verified stations', async () => {
    const station = await makeStation({
      name: 'Claimed-Only Station',
      slug: 'claimed-only-station-columbus-oh',
      regular: 3.599,
      status: 'CLAIMED',
    });

    await makeVerifiedOwner({
      stationId: station._id,
      email: 'owner.claimedonly@fuelify.local',
      phone: '+15550004444',
      password: 'DevPass123!',
    });

    const loginRes = await request(app).post('/api/auth/login').send({
      identifier: 'owner.claimedonly@fuelify.local',
      password: 'DevPass123!',
    });
    expect(loginRes.status).toBe(200);

    const token = loginRes.body.token;
    const updateRes = await request(app)
      .post('/api/dashboard/prices')
      .set('Authorization', `Bearer ${token}`)
      .send({ regular: 3.011 });

    expect(updateRes.status).toBe(403);
    expect(updateRes.body.error).toMatch(/enabled after verification approval/i);
  });

  test('POST /api/stations/:stationId/report rejects malformed stationId', async () => {
    const res = await request(app).post('/api/stations/not-an-objectid/report').send({
      type: 'WRONG_INFO',
      data: { message: 'bad' },
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Invalid stationId/);
    expect(res.body.code).toBe('INVALID_OBJECT_ID');
    expect(res.body.requestId).toBeTruthy();
  });

  test('claim lifecycle supports submit, status, and retry', async () => {
    const owner = await Owner.create({
      stationId: new mongoose.Types.ObjectId(),
      name: 'Claim Owner',
      email: 'claim.owner@fuelify.local',
      phone: '+15558889999',
      passwordHash: await bcrypt.hash('DevPass123!', 12),
      role: 'OWNER',
      isVerified: true,
    });

    const station = await makeStation({
      name: 'Claim Station',
      slug: 'claim-station-columbus-oh',
      regular: null,
      status: 'CLAIMED',
      claimedBy: owner._id,
    });
    await Owner.findByIdAndUpdate(owner._id, { stationId: station._id });

    const token = await loginAsOwner({ identifier: owner.email });

    const createRes = await request(app)
      .post('/api/claims')
      .set('Authorization', `Bearer ${token}`)
      .send({
        stationId: station._id.toString(),
        evidence: {
          businessName: 'Test Fuel LLC',
          businessRegistrationId: 'OH-123456',
          claimantName: 'Jane Owner',
          claimantEmail: 'owner@testfuel.example',
          claimantPhone: '+15558889999',
          website: 'https://testfuel.example',
        },
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.claimId).toBeTruthy();
    expect(createRes.body.status).toBeTruthy();

    const statusRes = await request(app)
      .get(`/api/claims/${createRes.body.claimId}/status`)
      .set('Authorization', `Bearer ${token}`);
    expect(statusRes.status).toBe(200);
    expect(statusRes.body.status).toBeTruthy();
    expect(statusRes.body.requestId).toBeTruthy();
    expect(statusRes.headers['x-request-id']).toBeTruthy();

    const summaryRes = await request(app).get(`/api/claims/station/${station._id.toString()}/summary`);
    expect(summaryRes.status).toBe(200);
    expect(summaryRes.body.stationId).toBe(station._id.toString());
    expect(summaryRes.body.requestId).toBeTruthy();
    expect(summaryRes.body.claim).toBeTruthy();
    expect(summaryRes.body.claim.claimId).toBe(createRes.body.claimId);
    expect(summaryRes.body.risk).toBeUndefined();
    expect(summaryRes.body.claim.reasonCode).toBeUndefined();
    expect(summaryRes.body.claim.message).toBeUndefined();
    expect(summaryRes.body.claim.decisionConfidence).toBeUndefined();
    expect(summaryRes.body.claim.sourceChecks).toBeUndefined();

    const storedClaim = await Claim.findById(createRes.body.claimId).lean();
    if (storedClaim.status === 'REJECTED' || storedClaim.status === 'BLOCKED') {
      const retryRes = await request(app)
        .post(`/api/claims/${storedClaim._id}/retry`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          evidence: {
            website: 'https://testfuel.example',
          },
        });

      expect([200, 429]).toContain(retryRes.status);
    }
  });

  test('GET /api/claims/station/:stationId/summary hides sensitive fields publicly and reveals them to owner', async () => {
    const owner = await Owner.create({
      stationId: new mongoose.Types.ObjectId(),
      name: 'Summary Owner',
      email: 'summary.owner@fuelify.local',
      phone: '+15550009993',
      passwordHash: await bcrypt.hash('DevPass123!', 12),
      role: 'OWNER',
      isVerified: true,
    });

    const station = await makeStation({
      name: 'Summary Station',
      slug: 'summary-station-columbus-oh',
      regular: 3.299,
      status: 'CLAIMED',
      claimedBy: owner._id,
    });
    await Owner.findByIdAndUpdate(owner._id, { stationId: station._id });

    const token = await loginAsOwner({ identifier: owner.email });
    const claimRes = await request(app)
      .post('/api/claims')
      .set('Authorization', `Bearer ${token}`)
      .send({
        stationId: station._id.toString(),
        evidence: {
          businessName: station.name,
          businessRegistrationId: 'OH-129876',
          claimantName: owner.name,
          claimantEmail: owner.email,
          claimantPhone: owner.phone,
          website: station.website,
        },
      });
    expect(claimRes.status).toBe(201);

    const publicRes = await request(app).get(`/api/claims/station/${station._id.toString()}/summary`);
    expect(publicRes.status).toBe(200);
    expect(publicRes.body.risk).toBeUndefined();
    expect(publicRes.body.claim).toHaveProperty('claimId');
    expect(publicRes.body.claim.reasonCode).toBeUndefined();
    expect(publicRes.body.claim.sourceChecks).toBeUndefined();

    const ownerRes = await request(app)
      .get(`/api/claims/station/${station._id.toString()}/summary`)
      .set('Authorization', `Bearer ${token}`);
    expect(ownerRes.status).toBe(200);
    expect(ownerRes.body.risk).toBeTruthy();
    expect(ownerRes.body.risk.status).toBeTruthy();
    expect(ownerRes.body.claim).toHaveProperty('reasonCode');
    expect(ownerRes.body.claim).toHaveProperty('message');
    expect(ownerRes.body.claim).toHaveProperty('decisionConfidence');
    expect(ownerRes.body.claim).toHaveProperty('sourceChecks');
    expect(ownerRes.body.claim).toHaveProperty('retryCount');
    expect(ownerRes.body.claim).toHaveProperty('decidedAt');
  });

  test('POST /api/claims requires authenticated owner token', async () => {
    const station = await makeStation({
      name: 'Unowned Claim Station',
      slug: 'unowned-claim-station-columbus-oh',
      regular: null,
      status: 'UNCLAIMED',
    });

    const res = await request(app).post('/api/claims').send({
      stationId: station._id.toString(),
      evidence: {
        businessName: 'Unowned Fuel LLC',
        businessRegistrationId: 'OH-654321',
        claimantName: 'Unauthorized User',
        claimantEmail: 'unauthorized@example.com',
        claimantPhone: '+15550000000',
      },
    });

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/no token/i);
  });

  test('approved claim promotes claimed station to VERIFIED', async () => {
    const owner = await Owner.create({
      stationId: new mongoose.Types.ObjectId(),
      name: 'Authority Owner',
      email: 'authority.owner@fuelify.local',
      phone: '+15557776666',
      passwordHash: await bcrypt.hash('DevPass123!', 12),
      role: 'OWNER',
      isVerified: true,
    });

    const station = await makeStation({
      name: 'Authority Station',
      slug: 'authority-station-columbus-oh',
      regular: 3.455,
      status: 'CLAIMED',
      claimedBy: owner._id,
    });

    await Owner.findByIdAndUpdate(owner._id, { stationId: station._id });

    const token = await loginAsOwner({ identifier: owner.email });

    const createRes = await request(app)
      .post('/api/claims')
      .set('Authorization', `Bearer ${token}`)
      .send({
        stationId: station._id.toString(),
        evidence: {
          businessName: 'Authority Station',
          businessRegistrationId: 'OH-998877',
          claimantName: 'Authority Owner',
          claimantEmail: 'owner@authorityfuel.com',
          claimantPhone: '+15557776666',
          website: 'https://authorityfuel.com',
        },
      });

    expect(createRes.status).toBe(201);
    expect(['APPROVED', 'REJECTED', 'BLOCKED']).toContain(createRes.body.status);

    const stationAfter = await Station.findById(station._id).lean();
    if (createRes.body.status === 'APPROVED') {
      expect(stationAfter.status).toBe('VERIFIED');
    } else {
      expect(stationAfter.status).toBe('CLAIMED');
    }
  });

  test('POST /api/prices creates report and returns expected shape', async () => {
    const station = await makeStation({
      name: 'Price Report Station',
      slug: 'price-report-station-columbus-oh',
      regular: 3.399,
      status: 'UNCLAIMED',
    });

    const res = await request(app).post('/api/prices').send({
      stationId: station._id.toString(),
      fuelType: 'petrol',
      price: 99.34,
    });

    expect(res.status).toBe(201);
    expect(res.body.reportId).toBeTruthy();
    expect(res.body.stationId).toBe(station._id.toString());
    expect(res.body.fuelType).toBe('petrol');
    expect(res.body.price).toBeCloseTo(99.34, 3);
    expect(res.body.reportedAt).toBeTruthy();
  });

  test('POST /api/prices with invalid fuelType returns 400', async () => {
    const station = await makeStation({
      name: 'Invalid Fuel Station',
      slug: 'invalid-fuel-station-columbus-oh',
      regular: 3.399,
      status: 'UNCLAIMED',
    });

    const res = await request(app).post('/api/prices').send({
      stationId: station._id.toString(),
      fuelType: 'regular',
      price: 88.11,
    });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_FUEL_TYPE');
  });

  test('POST /api/prices/:reportId/confirm increments confirmCount', async () => {
    const station = await makeStation({
      name: 'Confirm Increment Station',
      slug: 'confirm-increment-station-columbus-oh',
      regular: 3.499,
      status: 'UNCLAIMED',
    });
    const report = await PriceReport.create({
      stationId: station._id,
      fuelType: 'petrol',
      price: 101.11,
    });

    const res = await request(app).post(`/api/prices/${report._id.toString()}/confirm`).send({
      fingerprint: 'fingerprint-1',
    });

    expect(res.status).toBe(200);
    expect(res.body.confirmCount).toBe(1);
  });

  test('POST /api/prices/:reportId/confirm same fingerprint twice keeps count unchanged', async () => {
    const station = await makeStation({
      name: 'Confirm Idempotent Station',
      slug: 'confirm-idempotent-station-columbus-oh',
      regular: 3.499,
      status: 'UNCLAIMED',
    });
    const report = await PriceReport.create({
      stationId: station._id,
      fuelType: 'diesel',
      price: 95.11,
    });

    const firstRes = await request(app).post(`/api/prices/${report._id.toString()}/confirm`).send({
      fingerprint: 'fingerprint-repeat',
    });
    const secondRes = await request(app).post(`/api/prices/${report._id.toString()}/confirm`).send({
      fingerprint: 'fingerprint-repeat',
    });

    expect(firstRes.status).toBe(200);
    expect(secondRes.status).toBe(200);
    expect(firstRes.body.confirmCount).toBe(1);
    expect(secondRes.body.confirmCount).toBe(1);
  });

  test('GET /api/prices/:stationId/latest returns all 5 fuel types and null for unreported', async () => {
    const station = await makeStation({
      name: 'Latest Price Map Station',
      slug: 'latest-price-map-station-columbus-oh',
      regular: 3.199,
      status: 'UNCLAIMED',
    });

    await PriceReport.create({
      stationId: station._id,
      fuelType: 'petrol',
      price: 89.99,
      confirmCount: 2,
      reportedAt: new Date(),
    });

    const res = await request(app).get(`/api/prices/${station._id.toString()}/latest`);

    expect(res.status).toBe(200);
    expect(res.body.stationId).toBe(station._id.toString());
    expect(res.body.prices).toBeTruthy();
    expect(res.body.prices.petrol).toBeTruthy();
    expect(res.body.prices.petrol.price).toBeCloseTo(89.99, 3);
    expect(res.body.prices.petrol.confirmCount).toBe(2);
    expect(res.body.prices.diesel).toBeNull();
    expect(res.body.prices.premium).toBeNull();
    expect(res.body.prices.cng).toBeNull();
    expect(res.body.prices.ev).toBeNull();
  });

  test('POST /api/auth/login supports phone identifier login', async () => {
    const station = await makeStation({
      name: 'Phone Login Station',
      slug: 'phone-login-station-columbus-oh',
      regular: 3.499,
    });
    await makeVerifiedOwner({
      stationId: station._id,
      email: 'owner.phonelogin@fuelify.local',
      phone: '+15559990001',
      password: 'DevPass123!',
    });
    const res = await request(app).post('/api/auth/login').send({
      identifier: '+15559990001',
      password: 'DevPass123!',
    });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    expect(res.body.owner).toBeTruthy();
  });

  test('POST /api/auth/claim/initiate rejects invalid phone format', async () => {
    const station = await makeStation({
      name: 'Phone Format Station',
      slug: 'phone-format-station-columbus-oh',
      regular: null,
      status: 'UNCLAIMED',
    });
    const res = await request(app).post('/api/auth/claim/initiate').send({
      stationId: station._id.toString(),
      phone: 'not-a-phone',
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid phone/i);
  });

  test('POST /api/auth/claim/verify prevents claim takeover if station was claimed after OTP issuance', async () => {
    const station = await makeStation({
      name: 'Race Condition Station',
      slug: 'race-condition-station-columbus-oh',
      regular: null,
      status: 'UNCLAIMED',
    });
    await makePendingOwner({
      stationId: station._id,
      email: 'pending.race@fuelify.local',
      phone: '+15559990002',
      otp: '654321',
    });
    const otherOwner = await Owner.create({
      stationId: station._id,
      name: 'Other Owner',
      email: 'other.owner.race@fuelify.local',
      phone: '+15559990003',
      passwordHash: await bcrypt.hash('DevPass123!', 12),
      role: 'OWNER',
      isVerified: true,
    });
    await Station.findByIdAndUpdate(station._id, {
      status: 'CLAIMED',
      claimedBy: otherOwner._id,
    });
    const res = await request(app).post('/api/auth/claim/verify').send({
      stationId: station._id.toString(),
      phone: '+15559990002',
      otp: '654321',
      name: 'Race Owner',
      email: 'race@fuelify.local',
      password: 'DevPass123!',
    });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/claimed/i);
  });

  test('POST /api/auth/claim/verify normalizes email to lowercase for consistent login', async () => {
    const station = await makeStation({
      name: 'Email Normalize Station',
      slug: 'email-normalize-station-columbus-oh',
      regular: null,
      status: 'UNCLAIMED',
    });
    await makePendingOwner({
      stationId: station._id,
      email: 'pending.normalize@fuelify.local',
      phone: '+15559990004',
      otp: '111222',
    });
    const verifyRes = await request(app).post('/api/auth/claim/verify').send({
      stationId: station._id.toString(),
      phone: '+15559990004',
      otp: '111222',
      name: 'Normalize Owner',
      email: 'Normalize.Owner@Fuelify.LOCAL',
      password: 'DevPass123!',
    });
    expect(verifyRes.status).toBe(200);
    const loginRes = await request(app).post('/api/auth/login').send({
      identifier: 'normalize.owner@fuelify.local',
      password: 'DevPass123!',
    });
    expect(loginRes.status).toBe(200);
    expect(loginRes.body.token).toBeTruthy();
  });

  test('POST /api/admin/seed returns 503 when GOOGLE_PLACES_API_KEY is missing', async () => {
    const admin = await makeAdminOwner();
    const token = await loginAsOwner({ identifier: admin.email, password: 'AdminPass123!' });
    const savedKey = process.env.GOOGLE_PLACES_API_KEY;
    delete process.env.GOOGLE_PLACES_API_KEY;
    const res = await request(app)
      .post('/api/admin/seed')
      .set('Authorization', `Bearer ${token}`)
      .send({ dryRun: true });
    process.env.GOOGLE_PLACES_API_KEY = savedKey || '';
    expect(res.status).toBe(503);
    expect(res.body.error).toMatch(/GOOGLE_PLACES_API_KEY/i);
  });

  test('POST /api/admin/seed dry-run returns summary shape when API key is set', async () => {
    const admin = await makeAdminOwner();
    const token = await loginAsOwner({ identifier: admin.email, password: 'AdminPass123!' });
    const savedKey = process.env.GOOGLE_PLACES_API_KEY;
    process.env.GOOGLE_PLACES_API_KEY = 'test-placeholder-key';
    const res = await request(app)
      .post('/api/admin/seed')
      .set('Authorization', `Bearer ${token}`)
      .send({
        dryRun: true,
        stepKm: 100,
        bounds: { west: -83, south: 39.8, east: -82.8, north: 40.1 },
      });
    process.env.GOOGLE_PLACES_API_KEY = savedKey || '';
    expect(res.status).toBe(200);
    expect(res.body.mode).toBe('DRY_RUN');
    expect(typeof res.body.discoveredPlaces).toBe('number');
    expect(typeof res.body.wouldInsert).toBe('number');
    expect(typeof res.body.scannedPoints).toBe('number');
  });

  test('GET /api/admin/stations/incomplete returns only incomplete-address stations', async () => {
    const admin = await makeAdminOwner();
    const token = signOwnerToken(admin._id);

    await makeStation({
      name: 'Complete Address Station',
      slug: 'complete-address-station-columbus-oh',
      regular: 3.222,
      status: 'UNCLAIMED',
    });

    await Station.create({
      slug: 'incomplete-address-station-columbus-oh',
      name: 'Incomplete Address Station',
      brand: 'bp',
      address: {
        street: '',
        city: 'Columbus',
        state: 'OH',
        zip: '43215',
        country: 'US',
      },
      coordinates: { type: 'Point', coordinates: [-82.9988, 39.9612] },
      status: 'UNCLAIMED',
      prices: { regular: null, midgrade: null, premium: null, diesel: null, e85: null },
      dataSource: 'MANUAL',
    });

    const res = await request(app)
      .get('/api/admin/stations/incomplete')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.stations).toHaveLength(1);
    expect(res.body.stations[0].name).toBe('Incomplete Address Station');
  });

  test('PATCH /api/admin/stations/:id/address updates station and removes it from incomplete list', async () => {
    const admin = await makeAdminOwner();
    const token = signOwnerToken(admin._id);

    const station = await Station.create({
      slug: 'address-fix-station-columbus-oh',
      name: 'Address Fix Station',
      brand: 'shell',
      address: {
        street: '',
        city: 'Columbus',
        state: 'OH',
        zip: '43215',
        country: 'US',
      },
      coordinates: { type: 'Point', coordinates: [-82.9988, 39.9612] },
      status: 'UNCLAIMED',
      prices: { regular: null, midgrade: null, premium: null, diesel: null, e85: null },
      dataSource: 'MANUAL',
    });

    const patchRes = await request(app)
      .patch(`/api/admin/stations/${station._id.toString()}/address`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        address: {
          street: '205 W Front St',
          city: 'Columbus',
          state: 'OH',
          zip: '43215',
          country: 'US',
        },
      });

    expect(patchRes.status).toBe(200);
    expect(patchRes.body.station.address.street).toBe('205 W Front St');

    const incompleteRes = await request(app)
      .get('/api/admin/stations/incomplete')
      .set('Authorization', `Bearer ${token}`);

    expect(incompleteRes.status).toBe(200);
    const names = incompleteRes.body.stations.map((item) => item.name);
    expect(names).not.toContain('Address Fix Station');
  });

  test('GET /api/admin/stations/incomplete/summary returns aggregate data quality stats', async () => {
    const admin = await makeAdminOwner();
    const token = signOwnerToken(admin._id);

    await makeStation({
      name: 'Summary Complete Station',
      slug: 'summary-complete-station-columbus-oh',
      regular: 3.211,
      status: 'UNCLAIMED',
    });

    await Station.create({
      slug: 'summary-incomplete-station-columbus-oh',
      name: 'Summary Incomplete Station',
      brand: 'bp',
      placeId: 'test-place-001',
      address: {
        street: '',
        city: 'Columbus',
        state: 'OH',
        zip: '43215',
        country: 'US',
      },
      coordinates: { type: 'Point', coordinates: [-82.9988, 39.9612] },
      status: 'UNCLAIMED',
      prices: { regular: null, midgrade: null, premium: null, diesel: null, e85: null },
      dataSource: 'GOOGLE_PLACES',
    });

    const res = await request(app)
      .get('/api/admin/stations/incomplete/summary')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.totalStations).toBe(2);
    expect(res.body.incompleteTotal).toBe(1);
    expect(res.body.withPlaceId).toBe(1);
    expect(res.body.withoutPlaceId).toBe(0);
    expect(Array.isArray(res.body.byStatus)).toBe(true);
    expect(Array.isArray(res.body.byDataSource)).toBe(true);
  });

  test('POST /api/admin/stations/incomplete/autofix supports dry-run and execute address fixes', async () => {
    const admin = await makeAdminOwner();
    const token = signOwnerToken(admin._id);

    const station = await Station.create({
      slug: 'autofix-incomplete-station-columbus-oh',
      name: 'Autofix Incomplete Station',
      brand: 'shell',
      placeId: 'test-place-autofix-001',
      address: {
        street: '',
        city: '',
        state: 'OH',
        zip: '',
        country: 'US',
      },
      coordinates: { type: 'Point', coordinates: [-82.9988, 39.9612] },
      status: 'UNCLAIMED',
      prices: { regular: null, midgrade: null, premium: null, diesel: null, e85: null },
      dataSource: 'GOOGLE_PLACES',
    });

    const placeDetailsSpy = jest.spyOn(placesAPI, 'getPlaceDetails').mockResolvedValue({
      place_id: 'test-place-autofix-001',
      name: 'Autofix Incomplete Station',
      formatted_address: '205 W Front St, Columbus, OH 43215, USA',
      address_components: [
        { long_name: '205', short_name: '205', types: ['street_number'] },
        { long_name: 'W Front St', short_name: 'W Front St', types: ['route'] },
        { long_name: 'Columbus', short_name: 'Columbus', types: ['locality', 'political'] },
        { long_name: 'Ohio', short_name: 'OH', types: ['administrative_area_level_1', 'political'] },
        { long_name: '43215', short_name: '43215', types: ['postal_code'] },
        { long_name: 'United States', short_name: 'US', types: ['country', 'political'] },
      ],
    });

    const savedKey = process.env.GOOGLE_PLACES_API_KEY;
    process.env.GOOGLE_PLACES_API_KEY = 'test-google-places-key';

    const dryRunRes = await request(app)
      .post('/api/admin/stations/incomplete/autofix')
      .set('Authorization', `Bearer ${token}`)
      .send({ dryRun: true, limit: 50 });

    expect(dryRunRes.status).toBe(200);
    expect(dryRunRes.body.mode).toBe('DRY_RUN');
    expect(dryRunRes.body.fixed).toBe(1);

    const stationAfterDryRun = await Station.findById(station._id).lean();
    expect(stationAfterDryRun.address.street).toBe('');

    const executeRes = await request(app)
      .post('/api/admin/stations/incomplete/autofix')
      .set('Authorization', `Bearer ${token}`)
      .send({ dryRun: false, limit: 50 });

    process.env.GOOGLE_PLACES_API_KEY = savedKey || '';

    expect(executeRes.status).toBe(200);
    expect(executeRes.body.mode).toBe('EXECUTE');
    expect(executeRes.body.fixed).toBe(1);

    const stationAfterExecute = await Station.findById(station._id).lean();
    expect(stationAfterExecute.address.street).toBe('205 W Front St');
    expect(stationAfterExecute.address.city).toBe('Columbus');
    expect(stationAfterExecute.address.state).toBe('OH');
    expect(placeDetailsSpy).toHaveBeenCalled();
  });
});

