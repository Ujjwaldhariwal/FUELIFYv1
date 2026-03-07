const { subscribeDomainEvent } = require('../services/domainEvents');
const { invalidateStationCache } = require('../services/stationCache');

const EVENT_NAME = 'station.cache.invalidate';
let unsubscribe = null;

const startCacheInvalidationWorker = () => {
  if (unsubscribe) return;
  unsubscribe = subscribeDomainEvent(EVENT_NAME, async () => {
    try {
      await invalidateStationCache();
    } catch (err) {
      console.error('[CacheInvalidationWorker] failed:', err.message);
    }
  });
};

const stopCacheInvalidationWorker = () => {
  if (!unsubscribe) return;
  unsubscribe();
  unsubscribe = null;
};

module.exports = {
  EVENT_NAME,
  startCacheInvalidationWorker,
  stopCacheInvalidationWorker,
};
