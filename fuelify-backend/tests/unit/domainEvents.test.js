describe('domainEvents service (memory mode)', () => {
  beforeEach(() => {
    jest.resetModules();
    delete process.env.DOMAIN_EVENTS_PROVIDER;
    delete process.env.DOMAIN_EVENTS_CHANNEL;
  });

  test('initializes in memory mode by default', async () => {
    const events = require('../../src/services/domainEvents');
    const provider = await events.initializeDomainEvents();
    expect(provider).toBe('memory');
    expect(events.getDomainEventProvider()).toBe('memory');
    await events.closeDomainEvents();
  });

  test('publishDomainEvent delivers payload to subscriber', async () => {
    const events = require('../../src/services/domainEvents');
    await events.initializeDomainEvents();

    const payloadPromise = new Promise((resolve) => {
      events.subscribeDomainEvent('test.event', (payload) => resolve(payload));
    });

    await events.publishDomainEvent('test.event', { a: 1, b: 'ok' });
    const payload = await payloadPromise;

    expect(payload.a).toBe(1);
    expect(payload.b).toBe('ok');
    expect(payload.emittedAt).toBeTruthy();
    await events.closeDomainEvents();
  });

  test('unsubscribe detaches handler', async () => {
    const events = require('../../src/services/domainEvents');
    await events.initializeDomainEvents();

    const handler = jest.fn();
    const unsubscribe = events.subscribeDomainEvent('test.unsubscribe', handler);
    unsubscribe();

    await events.publishDomainEvent('test.unsubscribe', { value: 1 });
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(handler).not.toHaveBeenCalled();
    await events.closeDomainEvents();
  });
});
