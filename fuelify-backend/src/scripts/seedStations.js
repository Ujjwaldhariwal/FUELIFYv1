require('dotenv').config();

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const Station = require('../models/Station');

const slugify = (value) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

const normalizeBrand = (brand = '') => {
  const normalized = brand.toLowerCase().trim().replace(/\s+/g, '_');
  const validBrands = new Set([
    'marathon', 'shell', 'bp', 'exxon', 'chevron', 'arco', 'speedway', 'sunoco', 'citgo', 'gulf',
    'valero', 'costco', 'wawa', 'sheetz', 'caseys', 'pilot', 'loves', 'ta', 'circle_k', 'kwik_trip',
    'texaco', '76', 'phillips66', 'conoco', 'petro', 'thorntons', 'racetrac', 'holiday', 'maverik',
    'sinclair', 'cenex', 'quiktrip', 'bucees', 'independent', 'default',
  ]);
  return validBrands.has(normalized) ? normalized : 'default';
};

const usage = () => {
  console.log('Usage: node src/scripts/seedStations.js ./data/ohio-gas-stations.geojson');
};

const getInputPath = () => {
  const arg = process.argv[2];
  if (!arg) {
    usage();
    process.exit(1);
  }
  return path.isAbsolute(arg) ? arg : path.resolve(process.cwd(), arg);
};

const parseGeoJson = (inputPath) => {
  if (!fs.existsSync(inputPath)) {
    throw new Error(`GeoJSON file not found: ${inputPath}`);
  }

  const parsed = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  if (parsed.type !== 'FeatureCollection' || !Array.isArray(parsed.features)) {
    throw new Error('Input must be a FeatureCollection GeoJSON file');
  }
  return parsed.features;
};

const mapFeature = (feature) => {
  const tags = feature?.properties || {};
  const geometry = feature?.geometry;
  const coords = geometry?.coordinates;
  if (geometry?.type !== 'Point' || !Array.isArray(coords) || coords.length < 2) return null;

  const lng = Number(coords[0]);
  const lat = Number(coords[1]);
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;

  const name = String(tags.name || tags.brand || 'Gas Station').trim();
  const city = String(tags['addr:city'] || 'Unknown').trim();
  const street = String(tags['addr:street'] || '').trim();
  const state = String(tags['addr:state'] || 'OH').trim().toUpperCase().slice(0, 2) || 'OH';
  const zip = String(tags['addr:postcode'] || '').trim();

  return {
    placeId: tags.place_id ? String(tags.place_id) : undefined,
    osmId: tags.osm_id ? String(tags.osm_id) : undefined,
    slug: slugify(`${name}-${city}-${state}`),
    name,
    brand: normalizeBrand(tags.brand || tags.operator || ''),
    address: {
      street: street || null,
      city: city || null,
      state,
      zip: zip || null,
      country: 'US',
    },
    coordinates: { type: 'Point', coordinates: [lng, lat] },
    phone: tags.phone ? String(tags.phone).trim() : null,
    website: tags.website ? String(tags.website).trim() : null,
    hours: tags.opening_hours ? String(tags.opening_hours).trim() : null,
    status: 'UNCLAIMED',
    dataSource: 'OSM',
    confidenceScore: 0.5,
  };
};

const main = async () => {
  const inputPath = getInputPath();
  const features = parseGeoJson(inputPath);
  await mongoose.connect(process.env.MONGODB_URI);
  console.log(`[Seed] Connected. Features: ${features.length}`);

  let inserted = 0;
  let duplicates = 0;
  let errors = 0;

  for (let i = 0; i < features.length; i += 1) {
    try {
      const mapped = mapFeature(features[i]);
      if (!mapped) {
        errors += 1;
        continue;
      }

      const result = await Station.updateOne(
        { slug: mapped.slug },
        { $setOnInsert: mapped },
        { upsert: true, runValidators: true }
      );

      if (result.upsertedCount > 0) inserted += 1;
      else duplicates += 1;
    } catch (err) {
      errors += 1;
    }

    if ((i + 1) % 100 === 0) {
      console.log(`[Seed] ${i + 1}/${features.length} processed`);
    }
  }

  console.log(`Seeded ${inserted} | Skipped ${duplicates} duplicates | Errors ${errors}`);
  await mongoose.disconnect();
};

main().catch((err) => {
  console.error('[Seed] Failed:', err.message);
  process.exit(1);
});
