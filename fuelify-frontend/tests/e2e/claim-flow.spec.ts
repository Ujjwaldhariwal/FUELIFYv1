import { test, expect } from '@playwright/test';

const stationId = '64ac97071084f3836156aed1';

const stationPayload = {
  station: {
    _id: stationId,
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

test('claim flow submits and lands on status screen', async ({ page }) => {
  await page.route('**/api/stations/search**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        stations: [stationPayload.station],
      }),
    });
  });

  await page.route('**/api/stations/id/*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(stationPayload),
    });
  });

  await page.route('**/api/claims/station/*/summary', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        stationId,
        stationStatus: 'UNCLAIMED',
        risk: {
          status: 'clean',
          score: 0.1,
          reasons: [],
          evaluatedAt: new Date().toISOString(),
          blockedAt: null,
        },
        claim: null,
        requestId: 'req-summary',
      }),
    });
  });

  await page.route('**/api/auth/claim/initiate', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, message: 'OTP sent' }),
    });
  });

  await page.route('**/api/auth/resend-otp', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, message: 'OTP resent' }),
    });
  });

  await page.route('**/api/auth/claim/verify', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        token: 'mock-token',
        owner: { id: 'owner-1', name: 'Jane Owner', email: 'owner@mockfuel.com', role: 'OWNER' },
        station: { ...stationPayload.station, status: 'CLAIMED' },
      }),
    });
  });

  await page.route('**/api/claims', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          claimId: 'claim-1',
          status: 'PENDING',
          reasonCode: null,
          message: 'Verification in progress.',
          retryAt: null,
          slaEta: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
          requestId: 'req-claim',
        }),
      });
      return;
    }
    await route.fallback();
  });

  await page.route('**/api/claims/claim-1/status', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'PENDING',
        reasonCode: null,
        message: 'Verification in progress.',
        retryAt: null,
        slaEta: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        requestId: 'req-claim-status',
      }),
    });
  });

  await page.goto('/claim');
  await page.getByPlaceholder(/marathon killbuck/i).fill('Mock Fuel Station');
  await page.getByRole('button', { name: /find station/i }).click();
  await page.getByRole('button', { name: /mock fuel station/i }).click();

  await page.getByRole('button', { name: /yes, this is my station/i }).click();
  await page.getByPlaceholder('+1 (555) 000-0000').fill('+15550001111');
  await page.getByRole('button', { name: /send verification code/i }).click();

  const otpInputs = page.locator('input[maxlength=\"1\"]');
  await otpInputs.first().click();
  await page.keyboard.type('123456');
  await page.getByRole('button', { name: /continue/i }).click();

  await page.getByPlaceholder('Jane Smith').fill('Jane Owner');
  await page.getByPlaceholder('jane@mystation.com').fill('owner@mockfuel.com');
  await page.getByPlaceholder('Min 8 characters').fill('DevPass123!');
  await page.getByPlaceholder('Repeat password').fill('DevPass123!');
  await page.getByPlaceholder('OH-123456').fill('OH-123456');
  await page.getByPlaceholder('https://yourstation.com').fill('https://mockfuel.com');
  await page.getByRole('button', { name: /verify and create account/i }).click();

  await expect(page).toHaveURL(/\/dashboard\/claim\/status\/.+/);
  await expect(page.getByRole('heading', { name: /claim verification status/i })).toBeVisible();
});
