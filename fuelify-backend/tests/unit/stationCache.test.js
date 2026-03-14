describe('stationCache service dedupe + cache status', () => {
  let stationCache;

  const params = {
    lat: 40,
    lng: -82.9,
    radiusKm: 10,
    fuel: 'regular',
    page: 1,
    limit: 20,
    state: null,
    queryMode: 'near',
    bboxWest: null,
    bboxSouth: null,
    bboxEast: null,
    bboxNorth: null,
    zoom: 10,
  };

  beforeEach(async () => {
    jest.resetModules();
    process.env.STATION_CACHE_MODE = 'memory';
    process.env.STATION_CACHE_INVALIDATION_MODE = 'direct';
    stationCache = require('../../src/services/stationCache');
    await stationCache.initializeStationCache();
    await stationCache.invalidateStationCache();
  });

  afterEach(async () => {
    await stationCache.closeStationCache();
    delete process.env.STATION_CACHE_MODE;
    delete process.env.STATION_CACHE_INVALIDATION_MODE;
  });

  test('returns miss on first compute and hit on subsequent read', async () => {
    let resolverCalls = 0;
    const resolver = async () => {
      resolverCalls += 1;
      return { stations: [], total: 0 };
    };

    const first = await stationCache.getOrSetCachedStations(params, resolver);
    const second = await stationCache.getOrSetCachedStations(params, resolver);

    expect(first.cacheStatus).toBe('miss');
    expect(second.cacheStatus).toBe('hit');
    expect(resolverCalls).toBe(1);
  });

  test('dedupes concurrent cache misses into one resolver call', async () => {
    let resolverCalls = 0;
    const resolver = async () =>
      new Promise((resolve) => {
        setTimeout(() => {
          resolverCalls += 1;
          resolve({ stations: [{ _id: '1' }], total: 1 });
        }, 25);
      });

    const [first, second, third] = await Promise.all([
      stationCache.getOrSetCachedStations(params, resolver),
      stationCache.getOrSetCachedStations(params, resolver),
      stationCache.getOrSetCachedStations(params, resolver),
    ]);

    const statuses = [first.cacheStatus, second.cacheStatus, third.cacheStatus];
    expect(resolverCalls).toBe(1);
    expect(statuses.filter((status) => status === 'miss')).toHaveLength(1);
    expect(statuses.filter((status) => status === 'deduped')).toHaveLength(2);
    expect(stationCache.getStationCacheInFlightCount()).toBe(0);
  });
});
