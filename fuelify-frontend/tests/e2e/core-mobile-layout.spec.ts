import { expect, test } from '@playwright/test';

const widths = [320, 375, 390];

const stationPayload = {
  station: {
    _id: '64ac97071084f3836156aed1',
    name: 'Mock Fuel Station',
    brand: 'marathon',
    slug: 'mock-fuel-station-columbus-oh',
    address: {
      street: '205 W Front St',
      city: 'Columbus',
      state: 'OH',
      zip: '43215',
      country: 'US',
    },
    coordinates: { type: 'Point', coordinates: [-82.9988, 39.9612] },
    phone: '+15550001111',
    website: 'https://mockfuel.com',
    hours: 'Mon-Sun 6am-11pm',
    status: 'UNCLAIMED',
    prices: {
      regular: 3.199,
      midgrade: null,
      premium: null,
      diesel: null,
      e85: null,
      lastUpdated: null,
      updatedBy: null,
    },
    confidenceScore: 0.9,
    services: {
      carWash: true,
      airPump: true,
      atm: true,
      restrooms: true,
      convenience: true,
      diesel: true,
      evCharging: false,
    },
    metaDescription: '',
    viewCount: 0,
    searchAppearances: 0,
    dataSource: 'MANUAL',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
};

const noHorizontalOverflow = async (page: import('@playwright/test').Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

for (const width of widths) {
  test(`search page has no horizontal overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 850 });
    await page.route('**/api/stations/search**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ stations: [stationPayload.station] }),
      });
    });

    await page.goto('/search?q=mock&state=OH');
    await expect(page.getByRole('heading', { name: /find a station/i })).toBeVisible();
    await expect(noHorizontalOverflow(page)).resolves.toBe(true);
  });

  test(`station detail has no horizontal overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 850 });
    await page.route('**/api/stations/mock-fuel-station-columbus-oh', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          station: stationPayload.station,
          priceHistory: [],
        }),
      });
    });
    await page.route('**/api/prices/*/latest', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          stationId: stationPayload.station._id,
          prices: {
            petrol: null,
            diesel: null,
            premium: null,
            cng: null,
            ev: null,
          },
        }),
      });
    });

    await page.goto('/stations/oh/mock-fuel-station-columbus-oh');
    await expect(page.getByRole('heading', { name: /mock fuel station/i })).toBeVisible();
    await expect(noHorizontalOverflow(page)).resolves.toBe(true);
  });
}
