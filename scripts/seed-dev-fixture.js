const path = require('path');

require(path.resolve(__dirname, '../fuelify-backend/node_modules/dotenv')).config({
  path: path.resolve(__dirname, '../fuelify-backend/.env'),
});

const mongoose = require(path.resolve(__dirname, '../fuelify-backend/node_modules/mongoose'));
const bcrypt = require(path.resolve(__dirname, '../fuelify-backend/node_modules/bcryptjs'));

const Station = require(path.resolve(__dirname, '../fuelify-backend/src/models/Station'));
const Owner = require(path.resolve(__dirname, '../fuelify-backend/src/models/Owner'));
const { generateSlug } = require(path.resolve(__dirname, '../fuelify-backend/src/services/slugify'));

const FIXTURE = {
  stationName: 'Fuelify Dev Marathon',
  street: '205 W Front St',
  city: 'Columbus',
  state: 'OH',
  zip: '43215',
  brand: 'marathon',
  lat: 39.9612,
  lng: -82.9988,
  ownerName: 'Dev Owner',
  ownerEmail: 'owner+dev@fuelify.local',
  ownerPhone: '+15550001111',
  ownerPassword: 'DevPass123!',
};

async function seedFixture() {
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });

  const slug = generateSlug(FIXTURE.stationName, FIXTURE.street, FIXTURE.city, FIXTURE.state);

  const station = await Station.findOneAndUpdate(
    { slug },
    {
      name: FIXTURE.stationName,
      brand: FIXTURE.brand,
      address: {
        street: FIXTURE.street,
        city: FIXTURE.city,
        state: FIXTURE.state,
        zip: FIXTURE.zip,
        country: 'US',
      },
      coordinates: { lat: FIXTURE.lat, lng: FIXTURE.lng },
      phone: '+1-555-000-1111',
      website: 'https://fuelify.example/dev',
      hours: 'Mon-Sun 6am-11pm',
      status: 'UNCLAIMED',
      prices: {
        regular: 3.499,
        midgrade: 3.899,
        premium: 4.199,
        diesel: 3.799,
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
        ev_charging: false,
      },
      metaDescription: 'Dev fixture station for Fuelify integration checks.',
      dataSource: 'MANUAL',
    },
    { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true }
  );

  let owner = await Owner.findOne({ email: FIXTURE.ownerEmail });
  const passwordHash = await bcrypt.hash(FIXTURE.ownerPassword, 12);

  if (!owner) {
    owner = await Owner.create({
      stationId: station._id,
      name: FIXTURE.ownerName,
      email: FIXTURE.ownerEmail,
      phone: FIXTURE.ownerPhone,
      passwordHash,
      role: 'OWNER',
      isVerified: true,
      verificationOtp: null,
      verificationExpiry: null,
      lastLogin: null,
    });
  } else {
    owner.stationId = station._id;
    owner.name = FIXTURE.ownerName;
    owner.phone = FIXTURE.ownerPhone;
    owner.passwordHash = passwordHash;
    owner.role = 'OWNER';
    owner.isVerified = true;
    owner.verificationOtp = null;
    owner.verificationExpiry = null;
    await owner.save();
  }

  await Station.findByIdAndUpdate(station._id, {
    status: 'VERIFIED',
    claimedBy: owner._id,
    claimedAt: new Date(),
  });

  console.log(
    JSON.stringify({
      stationId: station._id.toString(),
      slug,
      ownerEmail: FIXTURE.ownerEmail,
      ownerPassword: FIXTURE.ownerPassword,
    })
  );

  await mongoose.disconnect();
}

seedFixture()
  .then(() => process.exit(0))
  .catch(async (err) => {
    console.error('[seed-dev-fixture] failed:', err.message);
    try {
      await mongoose.disconnect();
    } catch (_) {}
    process.exit(1);
  });
