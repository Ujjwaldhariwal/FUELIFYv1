require('dotenv').config();
const mongoose = require('mongoose');
const path     = require('path');
const fs       = require('fs');
const Station  = require('../models/Station');

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
  'getgo': 'default', 'fuel mart': 'default',
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

function mapToStation(element) {
  const tags = element.tags || {};

  // nodes → direct lat/lon, ways → center.lat/center.lon
  const lat = element.lat ?? element.center?.lat;
  const lng = element.lon ?? element.center?.lon;

  if (!lat || !lng || isNaN(lat) || isNaN(lng)) return null;

  const osmId   = String(element.id);
  const name    = tags.name || tags.brand || tags.operator || 'Gas Station';
  const city    = tags['addr:city']  || '';
  const state   = tags['addr:state'] || 'OH';
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
    phone: null, website: null, hours: null,
    claimedBy: null, claimedAt: null,
  };
}

async function seed() {
  const filename = process.argv[2] || 'ohio-full';
  const filePath = path.join(__dirname, 'data', `${filename}.json`);

  if (!fs.existsSync(filePath)) {
    console.error(`\n❌ File not found: ${filePath}`);
    console.error(`   Place your JSON file at: src/scripts/data/${filename}.json\n`);
    process.exit(1);
  }

  console.log(`📂 Reading: ${filePath}`);
  const raw      = fs.readFileSync(filePath, 'utf-8');
  const parsed   = JSON.parse(raw);
  const elements = parsed.elements || [];

  const nodes = elements.filter(e => e.type === 'node');
  const ways  = elements.filter(e => e.type === 'way');

  console.log(`📦 Total elements: ${elements.length}`);
  console.log(`   Nodes: ${nodes.length}`);
  console.log(`   Ways:  ${ways.length}`);

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('🟢 MongoDB Connected\n');

  let seeded = 0, skipped = 0, errors = 0;
  let firstError = null;

  for (let i = 0; i < elements.length; i++) {
    try {
      const doc = mapToStation(elements[i]);
      if (!doc) { errors++; continue; }

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
      process.stdout.write(`⏳ ${i + 1}/${elements.length} processed...\r`);
    }
  }

  const dbTotal = await Station.countDocuments();

  console.log(`\n${'═'.repeat(44)}`);
  console.log(`🏁  SEED COMPLETE`);
  console.log(`    Elements read:   ${elements.length}`);
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
