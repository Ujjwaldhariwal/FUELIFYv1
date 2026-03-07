process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_1234567890';
process.env.ADMIN_SECRET_KEY = process.env.ADMIN_SECRET_KEY || 'test_admin_secret_1234567890';

require('dotenv').config();

const request = require('supertest');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { MongoMemoryServer } = require('mongodb-memory-server');

const { app } = require('../../src/server');
const Station = require('../../src/models/Station');
const Owner = require('../../src/models/Owner');
const PriceHistory = require('../../src/models/PriceHistory');
const Claim = require('../../src/models/Claim');

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
  await Promise.all([Station.deleteMany({}), Owner.deleteMany({}), PriceHistory.deleteMany({}), Claim.deleteMany({})]);
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
    const station = await makeStation({
      name: 'Claim Station',
      slug: 'claim-station-columbus-oh',
      regular: null,
      status: 'UNCLAIMED',
    });

    const createRes = await request(app).post('/api/claims').send({
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

    const statusRes = await request(app).get(`/api/claims/${createRes.body.claimId}/status`);
    expect(statusRes.status).toBe(200);
    expect(statusRes.body.status).toBeTruthy();
    expect(statusRes.body.requestId).toBeTruthy();
    expect(statusRes.headers['x-request-id']).toBeTruthy();

    const summaryRes = await request(app).get(`/api/claims/station/${station._id.toString()}/summary`);
    expect(summaryRes.status).toBe(200);
    expect(summaryRes.body.stationId).toBe(station._id.toString());
    expect(summaryRes.body.risk.status).toBeTruthy();
    expect(summaryRes.body.requestId).toBeTruthy();
    expect(summaryRes.body.claim).toBeTruthy();
    expect(summaryRes.body.claim.claimId).toBe(createRes.body.claimId);

    const storedClaim = await Claim.findById(createRes.body.claimId).lean();
    if (storedClaim.status === 'REJECTED' || storedClaim.status === 'BLOCKED') {
      const retryRes = await request(app).post(`/api/claims/${storedClaim._id}/retry`).send({
        evidence: {
          website: 'https://testfuel.example',
        },
      });

      expect([200, 429]).toContain(retryRes.status);
    }
  });
});
