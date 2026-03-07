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
