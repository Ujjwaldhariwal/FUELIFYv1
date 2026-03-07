jest.mock('../../src/models/Station', () => ({
  findById: jest.fn(),
}));

jest.mock('../../src/services/placesAPI', () => ({
  getPlaceDetails: jest.fn(),
}));

const Station = require('../../src/models/Station');
const { getPlaceDetails } = require('../../src/services/placesAPI');
const { verifyClaim, tokenSimilarity } = require('../../src/services/claimVerification');

describe('claimVerification service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.GOOGLE_PLACES_API_KEY = 'test-key';
  });

  afterEach(() => {
    delete process.env.GOOGLE_PLACES_API_KEY;
  });

  test('approves strong matching claim evidence', async () => {
    Station.findById.mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        _id: 'station-1',
        name: 'Marathon Fuel Center',
        address: { street: '205 W Front St', city: 'Columbus', state: 'OH' },
        placeId: 'place-1',
        phone: '+1 (555) 000-1111',
        website: 'https://marathonfuel.com',
        dataSource: 'OSM',
        riskStatus: 'clean',
      }),
    });
    getPlaceDetails.mockResolvedValue({
      name: 'Marathon Fuel Center',
      formatted_phone_number: '+1 (555) 000-1111',
      website: 'https://marathonfuel.com',
    });

    const result = await verifyClaim({
      stationId: 'station-1',
      evidence: {
        businessName: 'Marathon Fuel Center',
        businessRegistrationId: 'OH-1234567',
        claimantName: 'Jane Owner',
        claimantEmail: 'owner@marathonfuel.com',
        claimantPhone: '+1 555 000 1111',
        website: 'https://marathonfuel.com',
      },
    });

    expect(result.status).toBe('APPROVED');
    expect(result.reasonCode).toBeNull();
    expect(result.decisionConfidence).toBeGreaterThanOrEqual(0.78);
    expect(result.sourceChecks.googleMatch).toBe(true);
    expect(result.sourceChecks.stateRegistryMatch).toBe(true);
  });

  test('gmail claimant email with business website is scored lower but not auto-rejected', async () => {
    Station.findById.mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        _id: 'station-2',
        name: 'Shell Downtown',
        address: { street: '10 Main St', city: 'Akron', state: 'OH' },
        placeId: null,
        phone: '+1 (555) 333-4444',
        website: 'https://shelldowntown.com',
        dataSource: 'OSM',
        riskStatus: 'clean',
      }),
    });

    const matchingDomainResult = await verifyClaim({
      stationId: 'station-2',
      evidence: {
        businessName: 'Shell Downtown',
        businessRegistrationId: 'OH-7654321',
        claimantName: 'John User',
        claimantEmail: 'owner@shelldowntown.com',
        claimantPhone: '+1 555 333 4444',
        website: 'https://shelldowntown.com',
      },
    });

    const gmailResult = await verifyClaim({
      stationId: 'station-2',
      evidence: {
        businessName: 'Shell Downtown',
        businessRegistrationId: 'OH-7654321',
        claimantName: 'John User',
        claimantEmail: 'owner@gmail.com',
        claimantPhone: '+1 555 333 4444',
        website: 'https://shelldowntown.com',
      },
    });

    expect(gmailResult.reasonCode).not.toBe('DOMAIN_MISMATCH');
    expect(gmailResult.status).toBe('APPROVED');
    expect(gmailResult.decisionConfidence).toBeLessThan(matchingDomainResult.decisionConfidence);
  });

  test('blocks claim when station is blocked by risk policy', async () => {
    Station.findById.mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        _id: 'station-3',
        name: 'Blocked Fuel',
        address: { street: '99 Risky Ave', city: 'Cleveland', state: 'OH' },
        placeId: 'place-3',
        phone: '+1 (555) 222-3333',
        website: 'https://blockedfuel.com',
        dataSource: 'OSM',
        riskStatus: 'blocked',
      }),
    });
    getPlaceDetails.mockResolvedValue({
      name: 'Blocked Fuel',
      formatted_phone_number: '+1 (555) 222-3333',
      website: 'https://blockedfuel.com',
    });

    const result = await verifyClaim({
      stationId: 'station-3',
      evidence: {
        businessName: 'Blocked Fuel',
        businessRegistrationId: 'OH-9999999',
        claimantName: 'Blocked Owner',
        claimantEmail: 'owner@blockedfuel.com',
        claimantPhone: '+1 555 222 3333',
        website: 'https://blockedfuel.com',
      },
    });

    expect(result.status).toBe('BLOCKED');
    expect(result.reasonCode).toBe('STATION_BLOCKED');
    expect(result.decisionConfidence).toBe(0);
  });

  test('token similarity returns normalized overlap score', () => {
    const score = tokenSimilarity('Marathon Fuel Center', 'Marathon Center');
    expect(score).toBeGreaterThan(0.4);
    expect(score).toBeLessThanOrEqual(1);
  });
});
