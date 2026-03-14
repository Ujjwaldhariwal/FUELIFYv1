#!/usr/bin/env node

const args = process.argv.slice(2);

const getArg = (name, fallback = null) => {
  const index = args.findIndex((arg) => arg === `--${name}`);
  if (index === -1) return fallback;
  return args[index + 1] ?? fallback;
};

const baseUrl = getArg('base', 'http://127.0.0.1:5000');
const iterations = Number.parseInt(getArg('iterations', '20'), 10);
const stationId = getArg('station-id', null);

if (!Number.isFinite(iterations) || iterations < 1) {
  console.error('iterations must be a positive integer');
  process.exit(1);
}

const endpoints = [
  {
    name: 'stations_nearby',
    path: '/api/stations?lat=39.9612&lng=-82.9988&fuel=regular&radius=25&limit=20',
  },
  {
    name: 'stations_clusters',
    path: '/api/stations/clusters?bbox=-83.20,39.80,-82.70,40.20&zoom=9&fuel=regular&limit=100',
  },
];

if (stationId) {
  endpoints.push({
    name: 'prices_latest',
    path: `/api/prices/${stationId}/latest`,
  });
}

const percentile = (sorted, p) => {
  if (sorted.length === 0) return null;
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[index];
};

const measureEndpoint = async ({ name, path }) => {
  const samples = [];
  let errors = 0;

  for (let i = 0; i < iterations; i += 1) {
    const startedAt = performance.now();
    try {
      const response = await fetch(`${baseUrl}${path}`);
      const finishedAt = performance.now();
      if (!response.ok) {
        errors += 1;
      }
      samples.push(finishedAt - startedAt);
    } catch (error) {
      errors += 1;
    }
  }

  const sorted = [...samples].sort((a, b) => a - b);
  const total = samples.reduce((sum, value) => sum + value, 0);

  return {
    endpoint: name,
    path,
    iterations,
    errors,
    minMs: sorted[0] ? Number(sorted[0].toFixed(2)) : null,
    p50Ms: percentile(sorted, 50) ? Number(percentile(sorted, 50).toFixed(2)) : null,
    p95Ms: percentile(sorted, 95) ? Number(percentile(sorted, 95).toFixed(2)) : null,
    maxMs: sorted[sorted.length - 1] ? Number(sorted[sorted.length - 1].toFixed(2)) : null,
    avgMs: sorted.length > 0 ? Number((total / sorted.length).toFixed(2)) : null,
  };
};

const run = async () => {
  console.log(`Measuring API latency against ${baseUrl} (iterations=${iterations})`);
  const results = [];
  for (const endpoint of endpoints) {
    // eslint-disable-next-line no-await-in-loop
    const result = await measureEndpoint(endpoint);
    results.push(result);
  }
  console.log(JSON.stringify({ measuredAt: new Date().toISOString(), results }, null, 2));
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
