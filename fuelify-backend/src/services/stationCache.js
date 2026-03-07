const DEFAULT_TTL_MS = 60 * 1000;
const CACHE_PREFIX = 'fuelify:stations:';
const CACHE_VERSION = 'v1';

const memoryCache = new Map();
let activeProvider = 'memory';
let redisClient = null;

const toPositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const buildKey = ({ lat, lng, radiusKm, fuel, page, limit, state }) =>
  `${CACHE_PREFIX}${CACHE_VERSION}:${JSON.stringify({
    lat: lat ?? null,
    lng: lng ?? null,
    radiusKm: radiusKm ?? null,
    fuel: fuel ?? null,
    page,
    limit,
    state: state ?? null,
  })}`;

const getMemory = (key) => {
  const item = memoryCache.get(key);
  if (!item) return null;
  if (item.expiresAt < Date.now()) {
    memoryCache.delete(key);
    return null;
  }
  return item.data;
};

const setMemory = (key, data, ttlMs) => {
  memoryCache.set(key, {
    data,
    expiresAt: Date.now() + ttlMs,
  });
};

const deleteMemoryByPrefix = (prefix) => {
  for (const key of memoryCache.keys()) {
    if (key.startsWith(prefix)) memoryCache.delete(key);
  }
};

const initializeStationCache = async () => {
  const mode = (process.env.STATION_CACHE_MODE || 'memory').toLowerCase();
  if (mode !== 'redis') {
    activeProvider = 'memory';
    return activeProvider;
  }

  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    console.warn('[StationCache] REDIS_URL missing; using memory cache');
    activeProvider = 'memory';
    return activeProvider;
  }

  try {
    // Keep redis optional so local/test setups don't require it.
    // eslint-disable-next-line global-require, import/no-extraneous-dependencies
    const { createClient } = require('redis');
    redisClient = createClient({ url: redisUrl });
    redisClient.on('error', (err) => {
      console.error('[StationCache] Redis error:', err.message);
    });
    await redisClient.connect();
    activeProvider = 'redis';
    console.log('[StationCache] Redis provider active');
    return activeProvider;
  } catch (err) {
    console.warn(`[StationCache] Redis unavailable (${err.message}); using memory cache`);
    redisClient = null;
    activeProvider = 'memory';
    return activeProvider;
  }
};

const closeStationCache = async () => {
  if (redisClient) {
    try {
      await redisClient.quit();
    } catch (err) {
      console.warn('[StationCache] Redis quit failed:', err.message);
    }
  }
  redisClient = null;
  activeProvider = 'memory';
};

const getCachedStations = async (params) => {
  const key = buildKey(params);

  if (activeProvider === 'redis' && redisClient) {
    const raw = await redisClient.get(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (err) {
      await redisClient.del(key);
      return null;
    }
  }

  return getMemory(key);
};

const setCachedStations = async (params, data, ttlMs = DEFAULT_TTL_MS) => {
  const key = buildKey(params);
  const normalizedTtlMs = toPositiveInt(ttlMs, DEFAULT_TTL_MS);

  if (activeProvider === 'redis' && redisClient) {
    const ttlSeconds = Math.ceil(normalizedTtlMs / 1000);
    await redisClient.setEx(key, ttlSeconds, JSON.stringify(data));
    return;
  }

  setMemory(key, data, normalizedTtlMs);
};

const invalidateStationCache = async () => {
  if (activeProvider === 'redis' && redisClient) {
    let cursor = '0';
    do {
      const result = await redisClient.scan(cursor, {
        MATCH: `${CACHE_PREFIX}${CACHE_VERSION}:*`,
        COUNT: 500,
      });
      cursor = result.cursor;
      const keys = result.keys || [];
      if (keys.length > 0) await redisClient.del(keys);
    } while (cursor !== '0');
    return;
  }

  deleteMemoryByPrefix(`${CACHE_PREFIX}${CACHE_VERSION}:`);
};

const getStationCacheProvider = () => activeProvider;

module.exports = {
  initializeStationCache,
  closeStationCache,
  getStationCacheProvider,
  getCachedStations,
  setCachedStations,
  invalidateStationCache,
};
