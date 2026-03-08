const path = require('path');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const Station = require('../models/Station');
const Owner = require('../models/Owner');
const PriceReport = require('../models/PriceReport');

const FIXTURE = {
  claimableStationId: '000000000000000000000101',
  ownerStationId: '000000000000000000000102',
  ownerId: '000000000000000000000201',
  claimablePhone: '+15550002222',
  ownerPhone: '+15550001111',
  ownerEmail: 'owner+dev@fuelify.local',
  ownerPassword: 'DevPass123!',
  otpCode: process.env.OTP_BYPASS_CODE || '123456',
};

const toObjectId = (value) => new mongoose.Types.ObjectId(value);

const upsertStations = async () => {
  const claimableStationId = toObjectId(FIXTURE.claimableStationId);
  const ownerStationId = toObjectId(FIXTURE.ownerStationId);
  const ownerId = toObjectId(FIXTURE.ownerId);

  await Station.deleteMany({
    slug: { $in: ['dev-claim-station-columbus-oh', 'dev-owner-station-columbus-oh'] },
    _id: { $nin: [claimableStationId, ownerStationId] },
  });

  await Station.updateOne(
    { _id: claimableStationId },
    {
      $set: {
        slug: 'dev-claim-station-columbus-oh',
        name: 'Fuelify Dev Claim Station',
        brand: 'marathon',
        address: {
          street: '205 W Front St',
          city: 'Columbus',
          state: 'OH',
          zip: '43215',
          country: 'US',
        },
        coordinates: { type: 'Point', coordinates: [-82.9988, 39.9612] },
        phone: FIXTURE.claimablePhone,
        website: 'https://dev-claim.fuelify.local',
        hours: 'Mon-Sun 6am-11pm',
        status: 'UNCLAIMED',
        claimedBy: null,
        claimedAt: null,
        prices: {
          regular: null,
          midgrade: null,
          premium: null,
          diesel: null,
          e85: null,
          lastUpdated: null,
          updatedBy: null,
        },
        riskStatus: 'clean',
        riskScore: 0,
        riskReasons: [],
        riskEvaluatedAt: new Date(),
        blockedAt: null,
        dataSource: 'MANUAL',
        confidenceScore: 1,
      },
    },
    { upsert: true, runValidators: true }
  );

  await Station.updateOne(
    { _id: ownerStationId },
    {
      $set: {
        slug: 'dev-owner-station-columbus-oh',
        name: 'Fuelify Dev Owner Station',
        brand: 'shell',
        address: {
          street: '120 N High St',
          city: 'Columbus',
          state: 'OH',
          zip: '43215',
          country: 'US',
        },
        coordinates: { type: 'Point', coordinates: [-83.0007, 39.9648] },
        phone: FIXTURE.ownerPhone,
        website: 'https://dev-owner.fuelify.local',
        hours: 'Mon-Sun 5am-12am',
        status: 'CLAIMED',
        claimedBy: ownerId,
        claimedAt: new Date(),
        prices: {
          regular: 3.189,
          midgrade: 3.489,
          premium: 3.789,
          diesel: 3.399,
          e85: 2.899,
          lastUpdated: new Date(),
          updatedBy: 'OWNER',
        },
        riskStatus: 'clean',
        riskScore: 0,
        riskReasons: [],
        riskEvaluatedAt: new Date(),
        blockedAt: null,
        dataSource: 'MANUAL',
        confidenceScore: 1,
      },
    },
    { upsert: true, runValidators: true }
  );
};

const upsertOwner = async () => {
  const ownerId = toObjectId(FIXTURE.ownerId);
  const ownerStationId = toObjectId(FIXTURE.ownerStationId);
  const passwordHash = await bcrypt.hash(FIXTURE.ownerPassword, 12);

  await Owner.deleteMany({
    $or: [{ email: FIXTURE.ownerEmail }, { phone: FIXTURE.ownerPhone }],
    _id: { $ne: ownerId },
  });

  await Owner.updateOne(
    { _id: ownerId },
    {
      $set: {
        stationId: ownerStationId,
        name: 'Dev Owner',
        email: FIXTURE.ownerEmail,
        phone: FIXTURE.ownerPhone,
        passwordHash,
        role: 'OWNER',
        isVerified: true,
        verificationOtp: null,
        verificationExpiry: null,
        otpFailureCount: 0,
        otpLockedUntil: null,
        loginFailureCount: 0,
        loginLockedUntil: null,
        lastLogin: null,
      },
    },
    { upsert: true, runValidators: true }
  );
};

const upsertPriceReports = async () => {
  const ownerStationId = toObjectId(FIXTURE.ownerStationId);
  const now = new Date();
  const reports = [
    { fuelType: 'petrol', price: 3.189, minsAgo: 12 },
    { fuelType: 'diesel', price: 3.399, minsAgo: 14 },
    { fuelType: 'premium', price: 3.789, minsAgo: 16 },
    { fuelType: 'cng', price: 2.959, minsAgo: 20 },
    { fuelType: 'ev', price: 0.349, minsAgo: 25 },
  ];

  for (const report of reports) {
    const reportedAt = new Date(now.getTime() - report.minsAgo * 60 * 1000);
    await PriceReport.updateOne(
      { stationId: ownerStationId, fuelType: report.fuelType },
      {
        $set: {
          stationId: ownerStationId,
          fuelType: report.fuelType,
          price: report.price,
          reportedBy: 'dev-seed',
          reportedAt,
          confirmedBy: ['dev-local-seed'],
          confirmCount: 1,
        },
      },
      { upsert: true, runValidators: true }
    );
  }
};

const main = async () => {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is required in fuelify-backend/.env');
  }

  await mongoose.connect(process.env.MONGODB_URI);
  try {
    await upsertStations();
    await upsertOwner();
    await upsertPriceReports();

    console.log('Dev bypass fixtures seeded.');
    console.log(`Claim test stationId: ${FIXTURE.claimableStationId}`);
    console.log(`Claim test phone: ${FIXTURE.claimablePhone}`);
    console.log(`Claim OTP (bypass mode): ${FIXTURE.otpCode}`);
    console.log(`Owner stationId: ${FIXTURE.ownerStationId}`);
    console.log(`Owner login email: ${FIXTURE.ownerEmail}`);
    console.log(`Owner login password: ${FIXTURE.ownerPassword}`);
  } finally {
    await mongoose.disconnect();
  }
};

if (require.main === module) {
  main().catch((err) => {
    console.error(`seedDevBypass failed: ${err.message}`);
    process.exit(1);
  });
}
