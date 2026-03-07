#!/usr/bin/env node
'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT    = path.resolve(__dirname, '..');
const OUT_DIR = __dirname;

// ── File lists ─────────────────────────────────────────────────────────────

const BACKEND_FILES = [
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
];

const FRONTEND_FILES = [
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

// ── Helpers ────────────────────────────────────────────────────────────────

function langTag(file) {
  const ext = path.extname(file).slice(1);
  if (ext === 'tsx') return 'tsx';
  if (ext === 'ts')  return 'typescript';
  if (ext === 'css') return 'css';
  if (ext === 'js')  return 'javascript';
  return ext || 'text';
}

function buildSnapshot(files, label) {
  const lines = [
    `# Fuelify — ${label} Source Snapshot`,
    `> Generated: ${new Date().toISOString()}`,
    `> Files: ${files.length}`,
    '',
  ];

  for (const rel of files) {
    const abs = path.join(ROOT, rel);
    lines.push('\n' + '─'.repeat(80));
    lines.push(`### ${rel}`);
    lines.push('```' + langTag(rel));
    try {
      lines.push(fs.readFileSync(abs, 'utf8').trimEnd());
    } catch {
      lines.push(`// [FILE NOT FOUND: ${rel}]`);
    }
    lines.push('```');
  }

  return lines.join('\n');
}

function generate() {
  const ts = new Date().toLocaleTimeString();

  fs.writeFileSync(
    path.join(OUT_DIR, 'backend.md'),
    buildSnapshot(BACKEND_FILES, 'Backend'),
    'utf8',
  );

  fs.writeFileSync(
    path.join(OUT_DIR, 'frontend.md'),
    buildSnapshot(FRONTEND_FILES, 'Frontend'),
    'utf8',
  );

  console.log(`[${ts}] backend.md + frontend.md updated`);
}

// ── Run ────────────────────────────────────────────────────────────────────

generate();

if (process.argv.includes('--watch')) {
  const watchDirs = [
    path.join(ROOT, 'fuelify-backend', 'src'),
    path.join(ROOT, 'fuelify-frontend', 'app'),
    path.join(ROOT, 'fuelify-frontend', 'components'),
    path.join(ROOT, 'fuelify-frontend', 'hooks'),
    path.join(ROOT, 'fuelify-frontend', 'services'),
    path.join(ROOT, 'fuelify-frontend', 'types'),
  ];

  let debounceTimer = null;

  for (const dir of watchDirs) {
    if (!fs.existsSync(dir)) continue;
    fs.watch(dir, { recursive: true }, (eventType, filename) => {
      if (!filename) return;
      // Ignore Next.js build output and OS temp files
      if (filename.includes('.next') || filename.endsWith('~')) return;
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        console.log(`[watch] change detected: ${filename}`);
        generate();
      }, 300);
    });
  }

  console.log('Watching for changes... (Ctrl+C to stop)');
}
