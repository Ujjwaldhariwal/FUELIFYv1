const {
  isPriceStale,
  applyConfirmation,
  isValidPriceValue,
} = require('../../src/routes/prices');

describe('price staleness and validation helpers', () => {
  test('isStale is true when reportedAt is 7 hours ago', () => {
    const sevenHoursAgo = new Date(Date.now() - 7 * 60 * 60 * 1000);
    expect(isPriceStale(sevenHoursAgo)).toBe(true);
  });

  test('isStale is false when reportedAt is 1 hour ago', () => {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    expect(isPriceStale(oneHourAgo)).toBe(false);
  });

  test('Duplicate fingerprint confirm does not increment confirmCount', () => {
    const report = {
      confirmedBy: ['fingerprint-a'],
      confirmCount: 1,
    };

    const result = applyConfirmation(report, 'fingerprint-a');
    expect(result.changed).toBe(false);
    expect(result.confirmCount).toBe(1);
    expect(report.confirmCount).toBe(1);
    expect(report.confirmedBy).toEqual(['fingerprint-a']);
  });

  test('Price validation rejects negative price', () => {
    expect(isValidPriceValue(-10)).toBe(false);
  });

  test('Price validation rejects price above 999.99', () => {
    expect(isValidPriceValue(1000)).toBe(false);
  });
});
