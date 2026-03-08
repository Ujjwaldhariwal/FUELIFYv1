require('dotenv').config();

const axios = require('axios');
const https = require('https');
const mongoose = require('mongoose');

const Station = require('../models/Station');
const PriceReport = require('../models/PriceReport');
const placesAPI = require('../services/placesAPI');

const PRICE_REPORTER = 'beta_seed_v1';
const AUTOFIX_DELAY_MS = 150;
const REVERSE_GEOCODE_DELAY_MS = 1100;
const REVERSE_GEOCODE_ENDPOINT = 'https://nominatim.openstreetmap.org/reverse';
const insecureHttpsAgent = new https.Agent({ rejectUnauthorized: false });
const CONNECT_RETRY_ATTEMPTS = 5;
const CONNECT_RETRY_DELAY_MS = 3000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const hasText = (value) => typeof value === 'string' && value.trim().length > 0;

const incompleteAddressFilter = (state) => ({
  ...(state ? { 'address.state': state } : {}),
  $or: [
    { 'address.street': { $exists: false } },
    { 'address.street': null },
    { 'address.street': { $not: /\S/ } },
    { 'address.city': { $exists: false } },
    { 'address.city': null },
    { 'address.city': { $not: /\S/ } },
  ],
});

const completeAddressFilter = (state) => ({
  ...(state ? { 'address.state': state } : {}),
  'address.street': { $type: 'string', $regex: /\S/ },
  'address.city': { $type: 'string', $regex: /\S/ },
});

const parseFormattedAddress = (formatted = '') => {
  const parts = String(formatted)
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length < 2) return null;

  const street = parts[0] || '';
  const city = parts.length >= 3 ? parts[parts.length - 3] : parts[1];
  const stateZipRaw = parts.length >= 2 ? parts[parts.length - 2] : '';
  const country = (parts[parts.length - 1] || 'US').toUpperCase();
  const stateZipMatch = stateZipRaw.match(/([A-Za-z]{2})(?:\s+([A-Za-z0-9-]+))?/);

  return {
    street,
    city,
    state: stateZipMatch?.[1]?.toUpperCase() || 'OH',
    zip: stateZipMatch?.[2] || '',
    country,
  };
};

const extractAddressFromPlaceDetails = (details) => {
  const components = Array.isArray(details?.address_components) ? details.address_components : [];

  const byType = (type) =>
    components.find((component) => Array.isArray(component.types) && component.types.includes(type));

  const streetNumber = byType('street_number')?.long_name || '';
  const route = byType('route')?.long_name || '';
  const street = `${streetNumber} ${route}`.trim() || route || '';
  const city =
    byType('locality')?.long_name ||
    byType('postal_town')?.long_name ||
    byType('administrative_area_level_2')?.long_name ||
    byType('sublocality')?.long_name ||
    '';
  const state = byType('administrative_area_level_1')?.short_name || 'OH';
  const zip = byType('postal_code')?.long_name || '';
  const country = byType('country')?.short_name || 'US';

  if (hasText(street) && hasText(city)) {
    return {
      street: street.trim(),
      city: city.trim(),
      state: String(state).trim().toUpperCase(),
      zip: String(zip).trim(),
      country: String(country).trim().toUpperCase(),
    };
  }

  return parseFormattedAddress(details?.formatted_address);
};

const parseArgs = () => {
  const args = process.argv.slice(2);
  const flags = new Set(args.filter((arg) => arg.startsWith('--')));

  const readValue = (prefix, fallback) => {
    const entry = args.find((arg) => arg.startsWith(`${prefix}=`));
    if (!entry) return fallback;
    return entry.slice(prefix.length + 1);
  };

  const stateRaw = String(readValue('--state', 'OH') || 'OH')
    .trim()
    .toUpperCase()
    .slice(0, 2);

  const toInt = (value, fallback) => {
    const parsed = parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  };

  return {
    execute: flags.has('--execute'),
    dryRun: flags.has('--dry-run') || !flags.has('--execute'),
    state: stateRaw || 'OH',
    autofixLimit: Math.min(toInt(readValue('--autofix-limit', '250'), 250), 1000),
    priceLimit: Math.min(toInt(readValue('--price-limit', '2000'), 2000), 10000),
    skipAutofix: flags.has('--skip-autofix'),
    skipPrices: flags.has('--skip-prices'),
    forcePrices: flags.has('--force-prices'),
    reverseGeocode: !flags.has('--skip-reverse-geocode'),
  };
};

const seededPricesForStation = (station) => {
  const idHex = String(station._id).slice(-6);
  const numericSeed = parseInt(idHex, 16) || 0;
  const base = 2.95 + (numericSeed % 95) / 100;
  const regular = Number(base.toFixed(3));
  const midgrade = Number((base + 0.25).toFixed(3));
  const premium = Number((base + 0.45).toFixed(3));
  const diesel = Number((base + 0.2).toFixed(3));
  const e85 = Number(Math.max(2.05, base - 0.4).toFixed(3));

  return { regular, midgrade, premium, diesel, e85 };
};

const buildMetrics = async (state) => {
  const [totalStations, incompleteStations, completeStations, pricedStations] = await Promise.all([
    Station.countDocuments(state ? { 'address.state': state } : {}),
    Station.countDocuments(incompleteAddressFilter(state)),
    Station.countDocuments(completeAddressFilter(state)),
    Station.countDocuments({
      ...completeAddressFilter(state),
      'prices.regular': { $ne: null },
    }),
  ]);

  const incompleteRatePct =
    totalStations > 0 ? Number(((incompleteStations / totalStations) * 100).toFixed(2)) : 0;
  const priceCoveragePct =
    completeStations > 0 ? Number(((pricedStations / completeStations) * 100).toFixed(2)) : 0;

  return {
    state,
    totalStations,
    completeStations,
    incompleteStations,
    incompleteRatePct,
    pricedStations,
    priceCoveragePct,
  };
};

const shouldRetryInsecureTls = (error) => {
  const message = String(error?.message || '').toLowerCase();
  const code = String(error?.code || '').toUpperCase();
  return (
    message.includes('unable to get local issuer certificate') ||
    code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' ||
    code === 'SELF_SIGNED_CERT_IN_CHAIN' ||
    code === 'DEPTH_ZERO_SELF_SIGNED_CERT'
  );
};

const reverseGeocodeFromCoordinates = async (lat, lng) => {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const requestConfig = {
    params: {
      lat,
      lon: lng,
      format: 'jsonv2',
      addressdetails: 1,
      zoom: 18,
    },
    timeout: 12000,
    headers: {
      'User-Agent': 'FuelifyDataPrep/1.0 (local beta prep)',
    },
  };

  let response;
  try {
    response = await axios.get(REVERSE_GEOCODE_ENDPOINT, requestConfig);
  } catch (error) {
    if (!shouldRetryInsecureTls(error)) throw error;
    response = await axios.get(REVERSE_GEOCODE_ENDPOINT, {
      ...requestConfig,
      httpsAgent: insecureHttpsAgent,
    });
  }

  const address = response.data?.address || {};
  const street =
    [address.house_number, address.road || address.pedestrian || address.path]
      .filter(Boolean)
      .join(' ')
      .trim() || '';
  const city =
    address.city || address.town || address.village || address.suburb || address.municipality || '';
  const state = (address.state_code || '').replace(/^US-/, '').trim().toUpperCase();
  const zip = address.postcode || '';
  const country = (address.country_code || 'us').toUpperCase();

  if (!hasText(street) || !hasText(city)) return null;

  return {
    street,
    city,
    state: state || 'OH',
    zip,
    country,
  };
};

const runAutofix = async ({ state, limit, execute, reverseGeocode }) => {
  const filter = incompleteAddressFilter(state);

  const candidates = await Station.find(filter)
    .sort({ createdAt: -1 })
    .limit(limit)
    .select('_id placeId name address coordinates')
    .lean();

  let scanned = 0;
  let fixed = 0;
  let fixedFromPlaces = 0;
  let fixedFromReverse = 0;
  let skippedNoPlaceId = 0;
  let skippedNoCoordinates = 0;
  let skippedNoDetails = 0;
  let skippedNoAddress = 0;
  let errors = 0;

  for (const station of candidates) {
    scanned += 1;
    try {
      let parsedAddress = null;
      let source = null;

      if (hasText(station.placeId) && process.env.GOOGLE_PLACES_API_KEY) {
        const details = await placesAPI.getPlaceDetails(station.placeId);
        if (details) {
          parsedAddress = extractAddressFromPlaceDetails(details);
          source = 'PLACES';
        } else {
          skippedNoDetails += 1;
        }
      } else if (!hasText(station.placeId)) {
        skippedNoPlaceId += 1;
      }

      if (!parsedAddress && reverseGeocode) {
        const coordinates = station?.coordinates?.coordinates;
        const lng = Array.isArray(coordinates) ? Number(coordinates[0]) : NaN;
        const lat = Array.isArray(coordinates) ? Number(coordinates[1]) : NaN;
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
          skippedNoCoordinates += 1;
        } else {
          parsedAddress = await reverseGeocodeFromCoordinates(lat, lng);
          if (parsedAddress) {
            source = 'REVERSE_GEOCODE';
          }
        }
      }

      if (!parsedAddress?.street || !parsedAddress?.city) {
        skippedNoAddress += 1;
        await sleep(source === 'REVERSE_GEOCODE' ? REVERSE_GEOCODE_DELAY_MS : AUTOFIX_DELAY_MS);
        continue;
      }

      if (execute) {
        const updateResult = await Station.updateOne(
          { _id: station._id },
          {
            $set: {
              address: {
                street: parsedAddress.street,
                city: parsedAddress.city,
                state: parsedAddress.state || station?.address?.state || state || 'OH',
                zip: parsedAddress.zip || station?.address?.zip || '',
                country: parsedAddress.country || station?.address?.country || 'US',
              },
            },
          },
          { runValidators: true }
        );
        if (updateResult.matchedCount > 0) fixed += 1;
      } else {
        fixed += 1;
      }

      if (source === 'PLACES') fixedFromPlaces += 1;
      if (source === 'REVERSE_GEOCODE') fixedFromReverse += 1;
    } catch (error) {
      errors += 1;
    }

    await sleep(REVERSE_GEOCODE_DELAY_MS);
  }

  return {
    candidates: candidates.length,
    scanned,
    fixed,
    fixedFromPlaces,
    fixedFromReverse,
    skippedNoPlaceId,
    skippedNoCoordinates,
    skippedNoDetails,
    skippedNoAddress,
    errors,
  };
};

const runPriceSeed = async ({ state, limit, execute, forcePrices }) => {
  const filter = {
    ...completeAddressFilter(state),
    ...(forcePrices ? {} : { 'prices.regular': null }),
  };

  const stations = await Station.find(filter)
    .sort({ createdAt: -1 })
    .limit(limit)
    .select('_id prices')
    .lean();

  let scanned = 0;
  let seeded = 0;

  for (const station of stations) {
    scanned += 1;
    const prices = seededPricesForStation(station);
    if (!execute) {
      seeded += 1;
      continue;
    }

    const reportedAt = new Date();

    await Station.updateOne(
      { _id: station._id },
      {
        $set: {
          prices: {
            regular: prices.regular,
            midgrade: prices.midgrade,
            premium: prices.premium,
            diesel: prices.diesel,
            e85: prices.e85,
            lastUpdated: reportedAt,
            updatedBy: 'AI',
          },
        },
      }
    );

    const reports = [
      { fuelType: 'petrol', price: prices.regular },
      { fuelType: 'diesel', price: prices.diesel },
      { fuelType: 'premium', price: prices.premium },
    ];

    for (const report of reports) {
      await PriceReport.updateOne(
        {
          stationId: station._id,
          fuelType: report.fuelType,
          reportedBy: PRICE_REPORTER,
        },
        {
          $set: {
            price: report.price,
            reportedAt,
          },
          $setOnInsert: {
            confirmCount: 0,
            confirmedBy: [],
          },
        },
        { upsert: true }
      );
    }

    seeded += 1;
  }

  return {
    candidates: stations.length,
    scanned,
    seeded,
  };
};

const printSummary = ({ mode, before, after, autofix, prices }) => {
  console.log('\n================ BETA DATA PREP ================');
  console.log(`Mode: ${mode}`);
  console.log(`State: ${before.state}`);
  console.log(`Before -> total ${before.totalStations}, incomplete ${before.incompleteStations} (${before.incompleteRatePct}%), priced ${before.pricedStations} (${before.priceCoveragePct}%)`);
  if (autofix) {
    console.log(
      `Autofix -> candidates ${autofix.candidates}, scanned ${autofix.scanned}, fixable ${autofix.fixed}, fromPlaces ${autofix.fixedFromPlaces}, fromReverse ${autofix.fixedFromReverse}, skippedNoPlaceId ${autofix.skippedNoPlaceId}, skippedNoCoordinates ${autofix.skippedNoCoordinates}, skippedNoDetails ${autofix.skippedNoDetails}, skippedNoAddress ${autofix.skippedNoAddress}, errors ${autofix.errors}`
    );
  }
  if (prices) {
    console.log(`Price seed -> candidates ${prices.candidates}, scanned ${prices.scanned}, seeded ${prices.seeded}`);
  }
  console.log(`After  -> total ${after.totalStations}, incomplete ${after.incompleteStations} (${after.incompleteRatePct}%), priced ${after.pricedStations} (${after.priceCoveragePct}%)`);
  console.log('================================================\n');
};

const connectWithRetry = async () => {
  let lastError = null;
  for (let attempt = 1; attempt <= CONNECT_RETRY_ATTEMPTS; attempt += 1) {
    try {
      await mongoose.connect(process.env.MONGODB_URI);
      return;
    } catch (error) {
      lastError = error;
      if (attempt < CONNECT_RETRY_ATTEMPTS) {
        console.log(
          `[prepareBetaData] Mongo connect attempt ${attempt}/${CONNECT_RETRY_ATTEMPTS} failed: ${error.message}. Retrying...`
        );
        await sleep(CONNECT_RETRY_DELAY_MS);
      }
    }
  }

  throw lastError || new Error('Failed to connect to MongoDB');
};

const main = async () => {
  const options = parseArgs();

  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is required');
  }

  await connectWithRetry();

  try {
    const before = await buildMetrics(options.state);
    let autofix = null;
    let prices = null;

    if (!options.skipAutofix) {
      autofix = await runAutofix({
        state: options.state,
        limit: options.autofixLimit,
        execute: options.execute,
        reverseGeocode: options.reverseGeocode,
      });
    }

    if (!options.skipPrices) {
      prices = await runPriceSeed({
        state: options.state,
        limit: options.priceLimit,
        execute: options.execute,
        forcePrices: options.forcePrices,
      });
    }

    const after = await buildMetrics(options.state);
    printSummary({
      mode: options.execute ? 'EXECUTE' : 'DRY_RUN',
      before,
      after,
      autofix,
      prices,
    });
  } finally {
    await mongoose.disconnect();
  }
};

if (require.main === module) {
  main().catch((error) => {
    console.error(`[prepareBetaData] Failed: ${error.message}`);
    process.exit(1);
  });
}
