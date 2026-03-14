const DEFAULT_TTL_MS = 60 * 1000;
const CACHE_PREFIX = 'fuelify:stations:';
const CACHE_VERSION = 'v1';

const memoryCache = new Map();
const inFlightResolutions = new Map();
let activeProvider = 'memory';
let redisClient = null;
let invalidationMode = 'direct';

const toPositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const buildKey = ({
  lat,
  lng,
  radiusKm,
  fuel,
  page,
  limit,
  state,
  queryMode,
  bboxWest,
  bboxSouth,
  bboxEast,
  bboxNorth,
  zoom,
}) =>
  `${CACHE_PREFIX}${CACHE_VERSION}:${JSON.stringify({
    lat: lat ?? null,
    lng: lng ?? null,
    radiusKm: radiusKm ?? null,
    fuel: fuel ?? null,
    page,
    limit,
    state: state ?? null,
    queryMode: queryMode ?? null,
    bboxWest: bboxWest ?? null,
    bboxSouth: bboxSouth ?? null,
    bboxEast: bboxEast ?? null,
    bboxNorth: bboxNorth ?? null,
    zoom: zoom ?? null,
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

const getCachedByKey = async (key) => {
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

const setCachedByKey = async (key, data, ttlMs = DEFAULT_TTL_MS) => {
  const normalizedTtlMs = toPositiveInt(ttlMs, DEFAULT_TTL_MS);

  if (activeProvider === 'redis' && redisClient) {
    const ttlSeconds = Math.ceil(normalizedTtlMs / 1000);
    await redisClient.setEx(key, ttlSeconds, JSON.stringify(data));
    return;
  }
  setMemory(key, data, normalizedTtlMs);
};

const initializeStationCache = async () => {
  invalidationMode = (process.env.STATION_CACHE_INVALIDATION_MODE || 'direct').toLowerCase();
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
  inFlightResolutions.clear();
};

const getCachedStations = async (params) => {
  const key = buildKey(params);
  return getCachedByKey(key);
};

const setCachedStations = async (params, data, ttlMs = DEFAULT_TTL_MS) => {
  const key = buildKey(params);
  await setCachedByKey(key, data, ttlMs);
};

const getOrSetCachedStations = async (params, resolver, ttlMs = DEFAULT_TTL_MS) => {
  const key = buildKey(params);
  const cached = await getCachedByKey(key);
  if (cached) {
    return {
      data: cached,
      cacheStatus: 'hit',
    };
  }

  const existingPromise = inFlightResolutions.get(key);
  if (existingPromise) {
    const deduped = await existingPromise;
    return {
      data: deduped,
      cacheStatus: 'deduped',
    };
  }

  const resolvePromise = (async () => {
    try {
      const computed = await resolver();
      await setCachedByKey(key, computed, ttlMs);
      return computed;
    } finally {
      inFlightResolutions.delete(key);
    }
  })();

  inFlightResolutions.set(key, resolvePromise);
  const computed = await resolvePromise;
  return {
    data: computed,
    cacheStatus: 'miss',
  };
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
  inFlightResolutions.clear();
};

const scheduleStationCacheInvalidation = async (payload = {}) => {
  if (invalidationMode === 'event') {
    try {
      const { publishDomainEvent } = require('./domainEvents');
      await publishDomainEvent('station.cache.invalidate', payload);
      return;
    } catch (err) {
      console.warn('[StationCache] Event invalidation unavailable; falling back to direct invalidation');
    }
  }
  await invalidateStationCache();
};

const getStationCacheProvider = () => activeProvider;
const getStationCacheInFlightCount = () => inFlightResolutions.size;

module.exports = {
  initializeStationCache,
  closeStationCache,
  getStationCacheProvider,
  getCachedStations,
  setCachedStations,
  getOrSetCachedStations,
  invalidateStationCache,
  scheduleStationCacheInvalidation,
  getStationCacheInFlightCount,
};
