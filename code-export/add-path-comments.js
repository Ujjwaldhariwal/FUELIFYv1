#!/usr/bin/env node
'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const FILES = [
  // ── Backend ──────────────────────────────────────────────────
  'fuelify-backend/src/server.js',
  'fuelify-backend/src/middleware/auth.js',
  'fuelify-backend/src/middleware/errorHandler.js',
  'fuelify-backend/src/middleware/rateLimit.js',
  'fuelify-backend/src/models/Station.js',
  'fuelify-backend/src/models/Owner.js',
  'fuelify-backend/src/models/PriceHistory.js',
  'fuelify-backend/src/models/UserReport.js',
  'fuelify-backend/src/routes/stations.js',
  'fuelify-backend/src/routes/auth.js',
  'fuelify-backend/src/routes/dashboard.js',
  'fuelify-backend/src/routes/admin.js',
  'fuelify-backend/src/services/email.js',
  'fuelify-backend/src/services/otp.js',
  'fuelify-backend/src/services/placesAPI.js',
  'fuelify-backend/src/services/slugify.js',
  'fuelify-backend/src/scripts/seedOhio.js',
  // ── Frontend ─────────────────────────────────────────────────
  'fuelify-frontend/types/index.ts',
  'fuelify-frontend/services/api.ts',
  'fuelify-frontend/hooks/useAuth.ts',
  'fuelify-frontend/app/globals.css',
  'fuelify-frontend/app/layout.tsx',
  'fuelify-frontend/app/page.tsx',
  'fuelify-frontend/app/search/page.tsx',
  'fuelify-frontend/app/claim/page.tsx',
  'fuelify-frontend/app/login/page.tsx',
  'fuelify-frontend/app/stations/[state]/[slug]/page.tsx',
  'fuelify-frontend/app/dashboard/page.tsx',
  'fuelify-frontend/app/dashboard/login/page.tsx',
  'fuelify-frontend/app/dashboard/analytics/page.tsx',
  'fuelify-frontend/app/dashboard/prices/page.tsx',
  'fuelify-frontend/app/dashboard/profile/page.tsx',
  'fuelify-frontend/app/dashboard/settings/page.tsx',
  'fuelify-frontend/app/dashboard/claim/[stationId]/page.tsx',
  'fuelify-frontend/components/ui/Button.tsx',
  'fuelify-frontend/components/ui/Card.tsx',
  'fuelify-frontend/components/ui/Input.tsx',
  'fuelify-frontend/components/ui/Badge.tsx',
  'fuelify-frontend/components/ui/Toast.tsx',
  'fuelify-frontend/components/ui/BottomSheet.tsx',
  'fuelify-frontend/components/ui/StationListCard.tsx',
  'fuelify-frontend/components/ui/BrandLogo.tsx',
  'fuelify-frontend/components/ui/OtpInput.tsx',
  'fuelify-frontend/components/ui/PriceGrid.tsx',
  'fuelify-frontend/components/ui/PriceCard.tsx',
  'fuelify-frontend/components/ui/Spinner.tsx',
  'fuelify-frontend/components/ui/LoadingSpinner.tsx',
  'fuelify-frontend/components/map/MapView.tsx',
  'fuelify-frontend/components/map/BottomSheet.tsx',
  'fuelify-frontend/components/map/FuelToggle.tsx',
  'fuelify-frontend/components/map/StationCard.tsx',
  'fuelify-frontend/components/dashboard/Sidebar.tsx',
  'fuelify-frontend/components/dashboard/StatCard.tsx',
  'fuelify-frontend/components/theme/ThemeContext.tsx',
];

let updated = 0;
let skipped = 0;

for (const rel of FILES) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) {
    console.log(`  [skip] not found: ${rel}`);
    skipped++;
    continue;
  }

  const isCss = rel.endsWith('.css');
  const comment = isCss
    ? `/* ${rel} */`
    : `// ${rel}`;

  const original = fs.readFileSync(abs, 'utf8');

  // Skip if the path comment is already the first line
  if (original.startsWith(comment)) {
    skipped++;
    continue;
  }

  // Remove any previous stale path comment on line 1 (same prefix pattern)
  let content = original;
  const firstLine = content.split('\n')[0];
  const staleJs  = firstLine.startsWith('// fuelify-');
  const staleCss = firstLine.startsWith('/* fuelify-') && firstLine.endsWith('*/');
  if (staleJs || staleCss) {
    content = content.slice(firstLine.length).replace(/^\n/, '');
  }

  fs.writeFileSync(abs, comment + '\n' + content, 'utf8');
  console.log(`  [ok]   ${rel}`);
  updated++;
}

console.log(`\nDone. ${updated} files updated, ${skipped} skipped.`);
