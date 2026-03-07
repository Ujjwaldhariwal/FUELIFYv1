const EventEmitter = require('events');

const emitter = new EventEmitter();
let initialized = false;
let provider = 'memory';

const initializeDomainEvents = async () => {
  if (initialized) return provider;
  initialized = true;
  provider = 'memory';
  return provider;
};

const publishDomainEvent = async (eventName, payload = {}) => {
  setImmediate(() => {
    emitter.emit(eventName, {
      ...payload,
      emittedAt: new Date().toISOString(),
    });
  });
};

const subscribeDomainEvent = (eventName, handler) => {
  emitter.on(eventName, handler);
  return () => emitter.off(eventName, handler);
};

const closeDomainEvents = async () => {
  emitter.removeAllListeners();
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
