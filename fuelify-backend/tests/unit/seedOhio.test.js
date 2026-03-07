const {
  normalizeBrand,
  generateStationSlug,
  mapFeatureToStation,
} = require('../../src/scripts/seedOhio');

describe('seedOhio mapping helpers', () => {
  test('normalizes known and unknown brands', () => {
    expect(normalizeBrand('Shell')).toBe('shell');
    expect(normalizeBrand('CircleK')).toBe('circle_k');
    expect(normalizeBrand('Unknown Brand')).toBe('default');
  });

  test('generates ohio slug format', () => {
    expect(generateStationSlug('Marathon Fuel', 'Columbus')).toBe('marathon-fuel-columbus-oh');
  });

  test('maps valid GeoJSON feature to station document', () => {
    const feature = {
      type: 'Feature',
      id: 'node/12345',
      geometry: { type: 'Point', coordinates: [-82.9988, 39.9612] },
      properties: {
        tags: {
          name: 'Shell Station',
          brand: 'Shell',
          'addr:housenumber': '205',
          'addr:street': 'W Front St',
          'addr:city': 'Columbus',
          'addr:state': 'OH',
          'addr:postcode': '43215',
          phone: '+1 555 000 1111',
          opening_hours: 'Mo-Su 06:00-23:00',
          website: 'https://example.com',
          'fuel:diesel': 'yes',
          shop: 'convenience',
        },
      },
    };

    const mapped = mapFeatureToStation(feature);

    expect(mapped).toBeTruthy();
    expect(mapped.slug).toBe('shell-station-columbus-oh');
    expect(mapped.brand).toBe('shell');
    expect(mapped.address.street).toBe('205 W Front St');
    expect(mapped.coordinates.coordinates).toEqual([-82.9988, 39.9612]);
    expect(mapped.status).toBe('UNCLAIMED');
    expect(mapped.dataSource).toBe('OSM');
    expect(mapped.services.diesel).toBe(true);
    expect(mapped.services.convenience).toBe(true);
  });

  test('returns null for invalid geometry', () => {
    const feature = {
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: [[0, 0], [1, 1]] },
      properties: {},
    };
    expect(mapFeatureToStation(feature)).toBeNull();
  });
});
