require('dotenv').config();

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const Station = require('../models/Station');

const VALID_BRANDS = new Set([
  'marathon',
  'shell',
  'bp',
  'exxon',
  'chevron',
  'arco',
  'speedway',
  'sunoco',
  'citgo',
  'gulf',
  'valero',
  'costco',
  'wawa',
  'sheetz',
  'caseys',
  'pilot',
  'loves',
  'ta',
  'circle_k',
  'kwik_trip',
  'texaco',
  '76',
  'phillips66',
  'conoco',
  'petro',
  'thorntons',
  'racetrac',
  'holiday',
  'maverik',
  'sinclair',
  'cenex',
  'quiktrip',
  'bucees',
  'independent',
  'default',
]);

const cleanText = (value) => {
  if (value === null || value === undefined) return '';
  return String(value).trim();
};

const normalizeBrand = (value) => {
  const normalized = cleanText(value).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  if (!normalized) return 'default';
  if (VALID_BRANDS.has(normalized)) return normalized;
  if (normalized === 'circlek') return 'circle_k';
  if (normalized === 'kwiktrip') return 'quiktrip';
  if (normalized === 'kwik_star') return 'kwik_trip';
  return 'default';
};

const slugify = (value) =>
  cleanText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 110);

const generateStationSlug = (name, city) => {
  const generated = slugify(`${name}-${city}-oh`);
  return generated || `gas-station-${Date.now()}`;
};

const toNullableText = (value) => {
  const cleaned = cleanText(value);
  return cleaned || null;
};

const toBooleanFromYes = (value) => cleanText(value).toLowerCase() === 'yes';

const toPointCoordinates = (geometry) => {
  if (!geometry || geometry.type !== 'Point' || !Array.isArray(geometry.coordinates)) return null;
  const lng = Number(geometry.coordinates[0]);
  const lat = Number(geometry.coordinates[1]);
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  if (lng < -180 || lng > 180 || lat < -90 || lat > 90) return null;
  return [lng, lat];
};

const extractTags = (feature) => {
  const properties = feature?.properties || {};
  if (properties.tags && typeof properties.tags === 'object') return properties.tags;
  return properties;
};

const mapFeatureToStation = (feature) => {
  const tags = extractTags(feature);
  const coordinates = toPointCoordinates(feature?.geometry);
  if (!coordinates) return null;

  const name = cleanText(tags.name || tags.brand || tags.operator || 'Gas Station');
  const city = cleanText(tags['addr:city'] || tags.city || 'Unknown');
  const stateRaw = cleanText(tags['addr:state'] || tags.state || 'OH').toUpperCase();
  const state = stateRaw.slice(0, 2) || 'OH';
  const street = cleanText(tags['addr:street']);
  const houseNumber = cleanText(tags['addr:housenumber']);
  const streetWithHouse = cleanText(`${houseNumber} ${street}`);

  return {
    placeId: toNullableText(tags.place_id || tags.placeId),
    osmId: toNullableText(tags.osm_id || tags.osmId || feature?.id),
    slug: generateStationSlug(name, city),
    name,
    brand: normalizeBrand(tags.brand || tags.operator),
    address: {
      street: streetWithHouse || null,
      city: city || null,
      state,
      zip: toNullableText(tags['addr:postcode'] || tags.zip),
      country: 'US',
    },
    coordinates: {
      type: 'Point',
      coordinates,
    },
    phone: toNullableText(tags.phone),
    website: toNullableText(tags.website),
    hours: toNullableText(tags.opening_hours),
    status: 'UNCLAIMED',
    dataSource: 'OSM',
    confidenceScore: 0.5,
    services: {
      carWash: toBooleanFromYes(tags.car_wash),
      airPump: toBooleanFromYes(tags.compressed_air),
      atm: toBooleanFromYes(tags.atm),
      restrooms: toBooleanFromYes(tags.toilets),
      convenience: cleanText(tags.shop).toLowerCase() === 'convenience',
      diesel: toBooleanFromYes(tags['fuel:diesel']),
      evCharging: Boolean(cleanText(tags['socket:type2'] || tags['amenity:charging_station'])),
    },
  };
};

const parseGeoJsonFile = (inputPath) => {
  if (!fs.existsSync(inputPath)) {
    throw new Error(`GeoJSON file not found: ${inputPath}`);
  }
  const parsed = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  if (parsed.type !== 'FeatureCollection' || !Array.isArray(parsed.features)) {
    throw new Error('Input must be a valid GeoJSON FeatureCollection');
  }
  return parsed.features;
};

const upsertStationBySlug = async (stationDoc) =>
  Station.updateOne({ slug: stationDoc.slug }, { $setOnInsert: stationDoc }, { upsert: true, runValidators: true });

const resolveInputPath = (arg) => {
  if (!arg) return null;
  if (path.isAbsolute(arg)) return arg;
  return path.resolve(process.cwd(), arg);
};

const seedOhioFromGeoJson = async (inputPath) => {
  const features = parseGeoJsonFile(inputPath);
  await mongoose.connect(process.env.MONGODB_URI);

  let seeded = 0;
  let skipped = 0;
  let errors = 0;

  try {
    for (let index = 0; index < features.length; index += 1) {
      try {
        const mapped = mapFeatureToStation(features[index]);
        if (!mapped) {
          errors += 1;
        } else {
          const result = await upsertStationBySlug(mapped);
          if (result.upsertedCount > 0) seeded += 1;
          else skipped += 1;
        }
      } catch (err) {
        errors += 1;
      }

      if ((index + 1) % 100 === 0) {
        console.log(`[seedOhio] Processed ${index + 1}/${features.length}`);
      }
    }
  } finally {
    await mongoose.disconnect();
  }

  return { seeded, skipped, errors, total: features.length };
};

const usage = () => {
  console.error('Usage: node src/scripts/seedOhio.js ./data/ohio-gas-stations.geojson');
};

const main = async () => {
  const inputPath = resolveInputPath(process.argv[2]);
  if (!inputPath) {
    usage();
    process.exit(1);
  }

  const result = await seedOhioFromGeoJson(inputPath);
  console.log(
    `\u2705 Seeded ${result.seeded} | \u23ED\uFE0F Skipped ${result.skipped} duplicates | \u274C ${result.errors} errors`
  );
};

if (require.main === module) {
  main().catch((err) => {
    console.error(`[seedOhio] Failed: ${err.message}`);
    process.exit(1);
  });
}

module.exports = {
  cleanText,
  normalizeBrand,
  generateStationSlug,
  mapFeatureToStation,
  parseGeoJsonFile,
  seedOhioFromGeoJson,
};
