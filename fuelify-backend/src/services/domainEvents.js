const EventEmitter = require('events');

const emitter = new EventEmitter();
let initialized = false;
let provider = 'memory';
const handlersByEvent = new Map();
let redisPublisher = null;
let redisSubscriber = null;
let channelName = 'fuelify:domain-events';

const dispatchEvent = (eventName, payload) => {
  emitter.emit(eventName, payload);

  const handlers = handlersByEvent.get(eventName);
  if (!handlers || handlers.size === 0) return;
  for (const handler of handlers) {
    try {
      handler(payload);
    } catch (err) {
      console.error('[DomainEvents] handler failed:', err.message);
    }
  }
};

const initializeMemoryProvider = () => {
  provider = 'memory';
  initialized = true;
  return provider;
};

const initializeDomainEvents = async () => {
  if (initialized) return provider;

  const requestedProvider = (process.env.DOMAIN_EVENTS_PROVIDER || 'memory').toLowerCase();
  channelName = process.env.DOMAIN_EVENTS_CHANNEL || 'fuelify:domain-events';

  if (requestedProvider !== 'redis') {
    return initializeMemoryProvider();
  }

  try {
    // Keep Redis optional in local/test where package may not be installed.
    // eslint-disable-next-line global-require, import/no-extraneous-dependencies
    const { createClient } = require('redis');
    redisPublisher = createClient({ url: process.env.REDIS_URL });
    redisSubscriber = redisPublisher.duplicate();

    redisPublisher.on('error', (err) => {
      console.error('[DomainEvents] Redis publisher error:', err.message);
    });
    redisSubscriber.on('error', (err) => {
      console.error('[DomainEvents] Redis subscriber error:', err.message);
    });

    await redisPublisher.connect();
    await redisSubscriber.connect();
    await redisSubscriber.subscribe(channelName, async (message) => {
      try {
        const parsed = JSON.parse(message);
        dispatchEvent(parsed.eventName, parsed.payload);
      } catch (err) {
        console.warn('[DomainEvents] Ignoring malformed redis event payload');
      }
    });

    provider = 'redis';
    initialized = true;
    return provider;
  } catch (err) {
    console.warn(`[DomainEvents] Redis unavailable (${err.message}); falling back to memory`);
    redisPublisher = null;
    redisSubscriber = null;
    return initializeMemoryProvider();
  }
};

const publishDomainEvent = async (eventName, payload = {}) => {
  if (!initialized) await initializeDomainEvents();
  const envelope = {
    eventName,
    payload: {
      ...payload,
      emittedAt: new Date().toISOString(),
    },
  };

  if (provider === 'redis' && redisPublisher) {
    await redisPublisher.publish(channelName, JSON.stringify(envelope));
    return;
  }

  setImmediate(() => {
    dispatchEvent(eventName, envelope.payload);
  });
};

const subscribeDomainEvent = (eventName, handler) => {
  if (provider === 'redis') {
    const handlers = handlersByEvent.get(eventName) || new Set();
    handlers.add(handler);
    handlersByEvent.set(eventName, handlers);
    return () => {
      const existing = handlersByEvent.get(eventName);
      if (!existing) return;
      existing.delete(handler);
      if (existing.size === 0) handlersByEvent.delete(eventName);
    };
  }

  emitter.on(eventName, handler);
  return () => emitter.off(eventName, handler);
};

const closeDomainEvents = async () => {
  emitter.removeAllListeners();
  handlersByEvent.clear();

  if (redisSubscriber) {
    try {
      await redisSubscriber.unsubscribe(channelName);
    } catch (err) {
      console.warn('[DomainEvents] Redis unsubscribe failed:', err.message);
    }
    try {
      await redisSubscriber.quit();
    } catch (err) {
      console.warn('[DomainEvents] Redis subscriber quit failed:', err.message);
    }
  }
  if (redisPublisher) {
    try {
      await redisPublisher.quit();
    } catch (err) {
      console.warn('[DomainEvents] Redis publisher quit failed:', err.message);
    }
  }

  redisSubscriber = null;
  redisPublisher = null;
  initialized = false;
  provider = 'memory';
};

const getDomainEventProvider = () => provider;

module.exports = {
  initializeDomainEvents,
  publishDomainEvent,
  subscribeDomainEvent,
  closeDomainEvents,
  getDomainEventProvider,
};
