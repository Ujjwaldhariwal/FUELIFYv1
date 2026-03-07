const memoryCache = new Map();
const DEFAULT_TTL_MS = 60 * 1000;

const buildKey = ({ lat, lng, radiusKm, fuel, page, limit, state }) =>
  JSON.stringify({
    lat: lat ?? null,
    lng: lng ?? null,
    radiusKm: radiusKm ?? null,
    fuel: fuel ?? null,
    page,
    limit,
    state: state ?? null,
  });

const getCachedStations = (params) => {
  const key = buildKey(params);
  const item = memoryCache.get(key);
  if (!item) return null;
  if (item.expiresAt < Date.now()) {
    memoryCache.delete(key);
    return null;
  }
  return item.data;
};

const setCachedStations = (params, data, ttlMs = DEFAULT_TTL_MS) => {
  const key = buildKey(params);
  memoryCache.set(key, {
    data,
    expiresAt: Date.now() + ttlMs,
  });
};

const invalidateStationCache = () => {
  memoryCache.clear();
};

module.exports = { getCachedStations, setCachedStations, invalidateStationCache };
