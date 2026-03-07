# Fuelify — Frontend Source Snapshot
> Generated: 2026-03-06T17:34:52.241Z
> Files: 37


────────────────────────────────────────────────────────────────────────────────
### fuelify-frontend/types/index.ts
```typescript
// fuelify-frontend/types/index.ts
export type FuelType = 'regular' | 'midgrade' | 'premium' | 'diesel' | 'e85';
export type StationStatus = 'UNCLAIMED' | 'CLAIMED' | 'VERIFIED';

export type StationBrand =
  | 'marathon'
  | 'shell'
  | 'bp'
  | 'exxon'
  | 'chevron'
  | 'arco'
  | 'speedway'
  | 'sunoco'
  | 'citgo'
  | 'gulf'
  | 'valero'
  | 'costco'
  | 'wawa'
  | 'sheetz'
  | 'casey'
  | 'pilot'
  | 'loves'
  | 'ta'
  | 'circle_k'
  | 'kwik_trip'
  | 'independent'
  | 'default';

export interface StationAddress {
  street: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}

export interface StationCoordinates {
  type: 'Point';
  coordinates: [number, number];
}

export interface StationPrices {
  regular: number | null;
  midgrade: number | null;
  premium: number | null;
  diesel: number | null;
  e85: number | null;
  lastUpdated: string | null;
  updatedBy: 'OWNER' | 'USER' | 'AI' | null;
}

export interface StationServices {
  carWash: boolean;
  airPump: boolean;
  atm: boolean;
  restrooms: boolean;
  convenience: boolean;
  diesel: boolean;
  evCharging: boolean;
}

export interface Station {
  id?: string;
  _id: string;
  placeId?: string;
  slug: string;
  name: string;
  brand: StationBrand;
  address: StationAddress;
  coordinates: StationCoordinates;
  phone: string;
  website: string;
  hours: string;
  status: StationStatus;
  claimedBy?: string;
  claimedAt?: string;
  prices: StationPrices;
  confidenceScore: number;
  services: StationServices;
  metaDescription: string;
  viewCount: number;
  searchAppearances: number;
  dataSource: 'GOOGLE_PLACES' | 'OSM' | 'MANUAL';
  distanceKm?: number;
  createdAt: string;
  updatedAt: string;
}

export interface PriceHistoryEntry {
  _id: string;
  stationId: string;
  submittedBy?: { _id: string; name: string; role: string };
  sourceType: 'OWNER' | 'USER' | 'AI_OCR' | 'FLEET';
  prices: Omit<StationPrices, 'lastUpdated' | 'updatedBy'>;
  confidenceScore: number;
  reportedAt: string;
}

export interface Owner {
  id: string;
  name: string;
  email: string;
  role: 'OWNER' | 'STAFF' | 'ADMIN';
}

export interface AuthState {
  token: string | null;
  owner: Owner | null;
  station: Station | null;
}

export interface ApiError {
  error: string;
}

export interface StationsResponse {
  stations: Station[];
  total: number;
}

export interface DashboardAnalytics {
  viewCount: number;
  searchAppearances: number;
  lastPriceUpdate: string | null;
  currentRegularPrice: number | null;
  rankInArea: number | null;
}
```

────────────────────────────────────────────────────────────────────────────────
### fuelify-frontend/services/api.ts
```typescript
// fuelify-frontend/services/api.ts
import axios, { AxiosError } from 'axios';
import type {
  DashboardAnalytics,
  Owner,
  PriceHistoryEntry,
  Station,
  StationPrices,
  StationsResponse,
} from '@/types';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

const api = axios.create({
  baseURL: `${BASE_URL}/api`,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT on every request if present in localStorage
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('fuelify_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 globally: clear token and redirect to login
api.interceptors.response.use(
  (res) => res,
  (err: AxiosError) => {
    if (err.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('fuelify_token');
      if (window.location.pathname.startsWith('/dashboard') || window.location.pathname === '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

// Public: Stations
export const fetchNearbyStations = async (
  lat: number,
  lng: number,
  radius = 25,
  fuel = 'regular',
  limit = 20
): Promise<StationsResponse> => {
  const { data } = await api.get('/stations', { params: { lat, lng, radius, fuel, limit } });
  return data;
};

export const fetchStationBySlug = async (
  slug: string
): Promise<{ station: Station; priceHistory: PriceHistoryEntry[] }> => {
  const { data } = await api.get(`/stations/${slug}`);
  return data;
};

export const searchStations = async (q: string, state = 'OH'): Promise<{ stations: Station[] }> => {
  const { data } = await api.get('/stations/search', { params: { q, state } });
  return data;
};

export const reportStation = async (
  stationId: string,
  type: string,
  reportData: Record<string, unknown>
): Promise<{ success: boolean; reportId: string }> => {
  const { data } = await api.post(`/stations/${stationId}/report`, { type, data: reportData });
  return data;
};

// Public: Auth / Claim
export const inititateClaim = async (stationId: string, phone: string) => {
  const { data } = await api.post('/auth/claim/initiate', { stationId, phone });
  return data;
};

export const verifyClaim = async (payload: {
  stationId: string;
  phone: string;
  otp: string;
  name: string;
  email: string;
  password: string;
}): Promise<{ token: string; owner: Owner; station: Station }> => {
  const { data } = await api.post('/auth/claim/verify', payload);
  return data;
};

export const resendOtp = async (phone: string, stationId: string) => {
  const { data } = await api.post('/auth/resend-otp', { phone, stationId });
  return data;
};

export const login = async (
  identifier: string,
  password: string
): Promise<{ token: string; owner: Owner; station: Station }> => {
  const { data } = await api.post('/auth/login', { identifier, password });
  return data;
};

// Protected: Dashboard
export const getDashboardStation = async (): Promise<{ station: Station }> => {
  const { data } = await api.get('/dashboard/station');
  return data;
};

export const updateStationProfile = async (
  updates: Partial<
    Pick<Station, 'name' | 'address' | 'phone' | 'website' | 'hours' | 'services' | 'brand'>
  >
): Promise<{ station: Station }> => {
  const { data } = await api.patch('/dashboard/station', updates);
  return data;
};

export const updatePrices = async (
  prices: Partial<Pick<StationPrices, 'regular' | 'midgrade' | 'premium' | 'diesel' | 'e85'>>
): Promise<{ success: boolean; prices: StationPrices }> => {
  const { data } = await api.post('/dashboard/prices', prices);
  return data;
};

export const getPriceHistory = async (): Promise<{ history: PriceHistoryEntry[] }> => {
  const { data } = await api.get('/dashboard/price-history');
  return data;
};

export const getAnalytics = async (): Promise<DashboardAnalytics> => {
  const { data } = await api.get('/dashboard/analytics');
  return data;
};

export default api;
```

────────────────────────────────────────────────────────────────────────────────
### fuelify-frontend/hooks/useAuth.ts
```typescript
// fuelify-frontend/hooks/useAuth.ts
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Owner, Station } from '@/types';
import { getDashboardStation } from '@/services/api';

export const useAuth = () => {
  const router = useRouter();
  const [owner, setOwner] = useState<Owner | null>(null);
  const [station, setStation] = useState<Station | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('fuelify_token');
    const ownerRaw = localStorage.getItem('fuelify_owner');

    if (!token || !ownerRaw) {
      router.push('/login');
      return;
    }

    setOwner(JSON.parse(ownerRaw) as Owner);

    getDashboardStation()
      .then(({ station: stationData }) => setStation(stationData))
      .catch(() => {
        localStorage.removeItem('fuelify_token');
        localStorage.removeItem('fuelify_owner');
        router.push('/login');
      })
      .finally(() => setLoading(false));
  }, [router]);

  return { owner, station, loading };
};
```

────────────────────────────────────────────────────────────────────────────────
### fuelify-frontend/app/globals.css
```css
/* fuelify-frontend/app/globals.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

/* ─── Design Tokens ─── */
:root {
  --bg-primary:    #F5F7FF;
  --bg-surface:    #FFFFFF;
  --bg-card:       #FFFFFF;
  --bg-elevated:   #ECEFFE;
  --bg-glass:      rgba(255, 255, 255, 0.80);

  --border:        rgba(79, 70, 229, 0.10);
  --border-strong: rgba(79, 70, 229, 0.24);

  --text-primary:   #0B0F1A;
  --text-secondary: #4A5470;
  --text-muted:     #8896AE;

  --accent-primary: #4F46E5;
  --accent-violet:  #7C3AED;
  --accent-green:   #059669;
  --accent-amber:   #D97706;
  --accent-red:     #DC2626;

  /* Legacy alias */
  --accent-blue: #4F46E5;
}

html.dark {
  --bg-primary:    #070B14;
  --bg-surface:    #0D1321;
  --bg-card:       #111927;
  --bg-elevated:   #182236;
  --bg-glass:      rgba(13, 19, 33, 0.82);

  --border:        rgba(255, 255, 255, 0.06);
  --border-strong: rgba(99, 102, 241, 0.30);

  --text-primary:   #EDF2FF;
  --text-secondary: #7B8FA8;
  --text-muted:     #374357;

  --accent-primary: #6366F1;
  --accent-violet:  #8B5CF6;
  --accent-green:   #10B981;
  --accent-amber:   #F59E0B;
  --accent-red:     #EF4444;

  --accent-blue: #6366F1;
}

/* ─── Base ─── */
html, body {
  min-height: 100%;
  background: var(--bg-primary);
  color: var(--text-primary);
}

body {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-feature-settings: 'rlig' 1, 'calt' 1, 'cv02' 1;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  font-size: clamp(14px, 2vw, 16px);
}

/* Smooth theme transitions — exclude transform so animations stay crisp */
*, *::before, *::after {
  transition:
    background-color 220ms ease,
    border-color     220ms ease,
    color            220ms ease,
    box-shadow       220ms ease;
}

/* ─── Animations ─── */
@keyframes fade-in-up {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
}

@keyframes fade-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}

@keyframes shimmer {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

@keyframes marker-pulse {
  0%, 100% { transform: scale(1);    box-shadow: 0 0 0 0   rgba(16,185,129,0.55); }
  50%       { transform: scale(1.09); box-shadow: 0 0 0 8px rgba(16,185,129,0); }
}

.fade-in-up { animation: fade-in-up 280ms cubic-bezier(0.22,1,0.36,1) both; }
.fade-in    { animation: fade-in    200ms ease-out both; }

/* ─── Skeleton shimmer ─── */
.skeleton-shimmer {
  background-image: linear-gradient(
    90deg,
    var(--bg-elevated) 0%,
    var(--bg-surface)  48%,
    var(--bg-elevated) 100%
  );
  background-size: 200% 100%;
  animation: shimmer 1.6s infinite;
}

/* ─── Map marker pulse ─── */
.marker-pulse { animation: marker-pulse 1.5s ease-in-out infinite; }

/* ─── Glass util ─── */
.glass {
  background: var(--bg-glass);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
}

/* ─── Gradient text ─── */
.text-gradient {
  background: linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

/* ─── Scrollbar ─── */
.hide-scrollbar { scrollbar-width: none; -ms-overflow-style: none; }
.hide-scrollbar::-webkit-scrollbar { display: none; }

/* ─── Leaflet ─── */
.leaflet-container {
  font-family: 'Inter', inherit;
  background: var(--bg-primary);
}
.leaflet-div-icon { background: none !important; border: none !important; }
.leaflet-control-zoom {
  border: 1px solid var(--border-strong) !important;
  border-radius: 14px !important;
  overflow: hidden;
  box-shadow: 0 4px 20px rgba(0,0,0,0.14) !important;
}
.leaflet-control-zoom a {
  background: var(--bg-surface) !important;
  color: var(--text-primary) !important;
  border-bottom: 1px solid var(--border) !important;
  width: 36px !important;
  height: 36px !important;
  line-height: 36px !important;
}
.leaflet-control-zoom a:hover { background: var(--bg-elevated) !important; }

/* ─── Safe area ─── */
.pt-safe { padding-top:    env(safe-area-inset-top); }
.pb-safe { padding-bottom: env(safe-area-inset-bottom); }
.pb-nav  { padding-bottom: calc(env(safe-area-inset-bottom) + 64px); }
```

────────────────────────────────────────────────────────────────────────────────
### fuelify-frontend/app/layout.tsx
```tsx
// fuelify-frontend/app/layout.tsx
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { ToastProvider } from '@/components/ui/Toast';
import { ThemeProvider } from '@/components/theme/ThemeContext';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
  weight: ['400', '500', '600', '700', '800', '900'],
});

export const metadata: Metadata = {
  title: 'Fuelify — Find the Cheapest Gas Near You',
  description:
    'Compare real-time gas prices at stations near you. Find the cheapest regular, premium, and diesel fuel in Ohio and beyond.',
  metadataBase: new URL('https://fuelify.com'),
  openGraph: { siteName: 'Fuelify', type: 'website' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`dark ${inter.variable}`}>
      <body className="bg-[var(--bg-primary)] text-[var(--text-primary)] antialiased" style={{ fontFamily: 'Inter, sans-serif' }}>
        <ThemeProvider>
          <ToastProvider>{children}</ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
```

────────────────────────────────────────────────────────────────────────────────
### fuelify-frontend/app/page.tsx
```tsx
// fuelify-frontend/app/page.tsx
'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Fuel, Locate, Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { FuelType, Station } from '@/types';
import { fetchNearbyStations } from '@/services/api';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { StationListCard } from '@/components/ui/StationListCard';

const MapView = dynamic(() => import('@/components/map/MapView').then((module) => module.MapView), {
  ssr: false,
  loading: () => <div className="h-full w-full skeleton-shimmer" />,
});

const FUEL_TYPES: FuelType[] = ['regular', 'midgrade', 'premium', 'diesel', 'e85'];
const FUEL_SHORT: Record<FuelType, string> = {
  regular: 'Reg',
  midgrade: 'Mid',
  premium: 'Prem',
  diesel: 'Diesel',
  e85: 'E85',
};
const DEFAULT_CENTER: [number, number] = [40.4173, -82.9071];

const formatRange = (stations: Station[], fuel: FuelType) => {
  const prices = stations
    .map((station) => station.prices?.[fuel])
    .filter((price): price is number => price !== null && price !== undefined);
  if (prices.length === 0) return '--';
  return `$${Math.min(...prices).toFixed(2)}-$${Math.max(...prices).toFixed(2)}`;
};

const toMiles = (distanceKm?: number) => {
  if (distanceKm === undefined) return null;
  return distanceKm * 0.621371;
};

export default function HomePage() {
  const router = useRouter();
  const [stations, setStations] = useState<Station[]>([]);
  const [selectedFuel, setSelectedFuel] = useState<FuelType>('regular');
  const [center, setCenter] = useState<[number, number]>(DEFAULT_CENTER);
  const [selectedStationId, setSelectedStationId] = useState<string | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState('');
  const [sheetOpen, setSheetOpen] = useState(true);
  const [loading, setLoading] = useState(true);

  const loadStations = useCallback(
    async (lat: number, lng: number) => {
      setLoading(true);
      try {
        const response = await fetchNearbyStations(lat, lng, 25, selectedFuel, 50);
        setStations(response.stations);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    },
    [selectedFuel]
  );

  useEffect(() => {
    loadStations(center[0], center[1]);
  }, [center, loadStations]);

  const handleLocate = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => setCenter([coords.latitude, coords.longitude]),
      () => { }
    );
  };

  const handleSearch = () => {
    if (searchQuery.trim().length < 2) return;
    router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}&state=OH`);
  };

  const bestStation = useMemo(() => {
    return stations
      .filter((station) => station.prices?.[selectedFuel] !== null && station.prices?.[selectedFuel] !== undefined)
      .sort((a, b) => (a.prices?.[selectedFuel] ?? Number.MAX_SAFE_INTEGER) - (b.prices?.[selectedFuel] ?? Number.MAX_SAFE_INTEGER))[0];
  }, [selectedFuel, stations]);

  const flyToBest = () => {
    if (!bestStation) return;
    const [lng, lat] = bestStation.coordinates.coordinates;
    if (lat === undefined || lng === undefined) return;
    setCenter([lat, lng]);
    setSelectedStationId(bestStation._id);
  };

  const renderStationList = () => (
    <div className="space-y-2 p-3">
      {loading
        ? Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="h-[88px] rounded-2xl skeleton-shimmer" />
        ))
        : stations.map((station) => (
          <StationListCard
            key={station._id}
            station={station}
            distance={toMiles(station.distanceKm ?? undefined) ?? undefined}
            selectedFuel={selectedFuel}
            onClick={() => {
              setSelectedStationId(station._id);
              const [lng, lat] = station.coordinates.coordinates;
              if (lat !== undefined && lng !== undefined) setCenter([lat, lng]);
            }}
          />
        ))}
    </div>
  );

  return (
    <main className="relative h-[100dvh] w-full overflow-hidden bg-[var(--bg-primary)]">

      {/* ── Desktop sidebar ── */}
      <aside className="hidden lg:absolute lg:inset-y-0 lg:left-0 lg:z-30 lg:flex lg:w-[380px] lg:flex-col lg:border-r lg:border-[var(--border)] lg:bg-[var(--bg-surface)]">
        <div className="border-b border-[var(--border)] px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-[0_2px_10px_rgba(99,102,241,0.40)]">
              <Fuel className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="text-base font-black leading-tight">Fuelify</p>
              <p className="text-xs text-[var(--text-muted)]">{stations.length} stations nearby</p>
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">{renderStationList()}</div>
      </aside>

      {/* ── Map ── */}
      <div className="absolute inset-0 lg:left-[380px]">
        <MapView
          stations={stations}
          selectedFuel={selectedFuel}
          center={center}
          onStationSelect={(station) => { setSelectedStationId(station._id); setSheetOpen(true); }}
          selectedStationId={selectedStationId}
        />
      </div>

      {/* ── Floating HUD ── */}
      <div className="pointer-events-none absolute left-0 right-0 top-0 z-[520] px-3 pt-safe sm:px-4 lg:left-[380px]">

        {/* Search bar */}
        <header className="pointer-events-auto mt-3">
          <div className={[
            'flex h-14 items-center gap-2 rounded-2xl border border-[var(--border-strong)] p-2',
            'glass shadow-[0_4px_24px_rgba(0,0,0,0.18)]',
          ].join(' ')}>
            {/* Brand pill */}
            <div className="flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 px-3 shadow-[0_2px_8px_rgba(99,102,241,0.38)]">
              <Fuel className="h-4 w-4 text-white" />
              <span className="text-sm font-black text-white tracking-tight">Fuelify</span>
            </div>

            {/* Search input */}
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                onKeyDown={(event) => event.key === 'Enter' && handleSearch()}
                placeholder="Search stations..."
                className={[
                  'h-10 w-full rounded-xl border border-[var(--border)] pl-9 pr-3 text-sm',
                  'bg-[var(--bg-surface)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)]',
                  'focus:border-[var(--accent-primary)] focus:outline-none focus:ring-2 focus:ring-[color:rgba(99,102,241,0.18)]',
                  'transition-all duration-200',
                ].join(' ')}
              />
            </div>

            {/* Locate button */}
            <button
              type="button"
              onClick={handleLocate}
              className={[
                'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
                'border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-secondary)]',
                'transition-all duration-200 hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary)]',
                'focus:outline-none active:scale-90',
              ].join(' ')}
            >
              <Locate className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* Fuel type tabs */}
        <section className="pointer-events-auto mt-2 hide-scrollbar overflow-x-auto">
          <div className={[
            'inline-flex min-w-full gap-1.5 rounded-2xl border border-[var(--border-strong)] p-1.5',
            'glass shadow-[0_4px_20px_rgba(0,0,0,0.14)]',
          ].join(' ')}>
            {FUEL_TYPES.map((fuel) => {
              const active = selectedFuel === fuel;
              return (
                <button
                  key={fuel}
                  type="button"
                  onClick={() => setSelectedFuel(fuel)}
                  className={[
                    'flex min-w-[120px] flex-1 flex-col rounded-xl px-3 py-2 text-left text-xs font-semibold',
                    'transition-all duration-200 focus:outline-none active:scale-95',
                    active
                      ? 'bg-gradient-to-r from-indigo-500 to-violet-600 text-white shadow-[0_2px_10px_rgba(99,102,241,0.40)]'
                      : 'text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]',
                  ].join(' ')}
                >
                  <span className="font-bold">{FUEL_SHORT[fuel]}</span>
                  <span className={['mt-0.5 text-[11px]', active ? 'text-indigo-100' : 'text-[var(--text-muted)]'].join(' ')}>
                    {formatRange(stations, fuel)}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Best price banner */}
        {bestStation && bestStation.prices[selectedFuel] && (
          <button
            type="button"
            onClick={flyToBest}
            className={[
              'pointer-events-auto mt-2 flex items-center gap-2 rounded-xl px-4 py-2.5',
              'border border-emerald-500/30 bg-emerald-500/15 text-emerald-400',
              'text-xs font-bold backdrop-blur-sm',
              'transition-all duration-200 hover:bg-emerald-500/20 active:scale-95',
              'shadow-[0_2px_14px_rgba(16,185,129,0.20)]',
              'focus:outline-none',
            ].join(' ')}
          >
            <span className="text-base leading-none">↓</span>
            <span>
              Best <strong>${bestStation.prices[selectedFuel]!.toFixed(2)}</strong> · {bestStation.name}
              {bestStation.distanceKm !== undefined && (
                <span className="ml-1 opacity-80">{(bestStation.distanceKm * 0.621371).toFixed(1)} mi</span>
              )}
            </span>
          </button>
        )}
      </div>

      {/* ── Mobile BottomSheet ── */}
      <div className="lg:hidden">
        <BottomSheet
          isOpen={sheetOpen}
          onClose={() => setSheetOpen(false)}
          title={`Stations near you (${stations.length})`}
          snapPoints={[130, '50vh', '90vh']}
        >
          {renderStationList()}
        </BottomSheet>

        {!sheetOpen && (
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            className={[
              'fixed bottom-6 left-1/2 z-[700] -translate-x-1/2',
              'flex h-12 items-center gap-2 rounded-full px-6',
              'bg-gradient-to-r from-indigo-500 to-violet-600 text-white text-sm font-bold',
              'shadow-[0_4px_20px_rgba(99,102,241,0.50)]',
              'transition-all duration-200 hover:shadow-[0_6px_28px_rgba(99,102,241,0.65)] active:scale-95',
            ].join(' ')}
          >
            <Fuel className="h-4 w-4" />
            See {stations.length} Stations
          </button>
        )}
      </div>
    </main>
  );
}
```

────────────────────────────────────────────────────────────────────────────────
### fuelify-frontend/app/search/page.tsx
```tsx
// fuelify-frontend/app/search/page.tsx
'use client';

import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { MapPin, Search } from 'lucide-react';
import type { Station } from '@/types';
import { searchStations } from '@/services/api';
import { BrandLogo } from '@/components/ui/BrandLogo';
import { StatusBadge } from '@/components/ui/Badge';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

function SearchPageContent() {
  const params = useSearchParams();
  const [query, setQuery] = useState(params.get('q') || '');
  const [results, setResults] = useState<Station[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const doSearch = async (q: string) => {
    if (q.trim().length < 2) return;

    setLoading(true);
    setSearched(true);
    try {
      const { stations } = await searchStations(q.trim(), 'OH');
      setResults(stations);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const q = params.get('q');
    if (q) {
      setQuery(q);
      doSearch(q);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <div className="mx-auto max-w-2xl px-4 py-6">

        {/* Back link */}
        <Link
          href="/"
          className="mb-5 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--text-secondary)] transition-colors hover:text-[var(--accent-primary)]"
        >
          ← Back to Map
        </Link>

        <h1 className="mb-5 text-2xl font-black tracking-tight">Find a Station</h1>

        {/* Search bar */}
        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && doSearch(query)}
            placeholder="Search by name, address, or city..."
            className={[
              'h-14 w-full rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)]',
              'pl-11 pr-28 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]',
              'shadow-[0_2px_12px_rgba(0,0,0,0.06)] dark:shadow-[0_2px_16px_rgba(0,0,0,0.22)]',
              'focus:border-[var(--accent-primary)] focus:outline-none focus:ring-2 focus:ring-[color:rgba(99,102,241,0.18)]',
              'transition-all duration-200',
            ].join(' ')}
          />
          <button
            type="button"
            onClick={() => doSearch(query)}
            className={[
              'absolute right-2 top-1/2 -translate-y-1/2',
              'h-10 rounded-xl px-4 text-sm font-bold text-white',
              'bg-gradient-to-r from-indigo-500 to-violet-600',
              'shadow-[0_2px_10px_rgba(99,102,241,0.35)]',
              'transition-all duration-200 hover:brightness-110 active:scale-95',
            ].join(' ')}
          >
            Search
          </button>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex justify-center py-16">
            <LoadingSpinner size="lg" />
          </div>
        )}

        {/* No results */}
        {!loading && searched && results.length === 0 && (
          <div className="py-16 text-center">
            <p className="text-2xl mb-2">🔍</p>
            <p className="font-semibold text-[var(--text-primary)]">No stations found</p>
            <p className="mt-1 text-sm text-[var(--text-muted)]">for &ldquo;{query}&rdquo;</p>
          </div>
        )}

        {/* Results */}
        {!loading && results.length > 0 && (
          <div className="space-y-2">
            <p className="mb-3 text-sm font-semibold text-[var(--text-secondary)]">
              {results.length} station{results.length !== 1 ? 's' : ''} found
            </p>

            {results.map((station) => (
              <Link
                key={station._id}
                href={`/stations/${station.address.state.toLowerCase()}/${station.slug}`}
                className={[
                  'group flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-3',
                  'transition-all duration-200',
                  'hover:border-[var(--border-strong)] hover:shadow-[0_2px_14px_rgba(99,102,241,0.10)]',
                ].join(' ')}
              >
                <BrandLogo brand={station.brand} size={44} />

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-[var(--text-primary)] group-hover:text-[var(--accent-primary)] transition-colors">
                    {station.name}
                  </p>
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-[var(--text-secondary)]">
                    <MapPin className="h-3 w-3 shrink-0" />
                    {station.address.street}, {station.address.city}
                  </p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <StatusBadge status={station.status} size="sm" />
                    {station.prices?.regular && (
                      <span className="text-xs font-bold text-[var(--accent-green)]">
                        ${station.prices.regular.toFixed(2)}/gal
                      </span>
                    )}
                  </div>
                </div>

                <span className="shrink-0 text-[var(--text-muted)] transition-colors group-hover:text-[var(--accent-primary)]">›</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950" />}>
      <SearchPageContent />
    </Suspense>
  );
}
```

────────────────────────────────────────────────────────────────────────────────
### fuelify-frontend/app/claim/page.tsx
```tsx
// fuelify-frontend/app/claim/page.tsx
'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle, Fuel, Search, Shield, Zap } from 'lucide-react';
import type { Station } from '@/types';
import { searchStations } from '@/services/api';
import { BrandLogo } from '@/components/ui/BrandLogo';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

function ClaimLandingPageContent() {
  const router = useRouter();
  const params = useSearchParams();
  const prefilledId = params.get('stationId');

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Station[]>([]);
  const [loading, setLoading] = useState(false);

  const search = async () => {
    if (query.trim().length < 2) return;
    setLoading(true);
    try {
      const { stations } = await searchStations(query, 'OH');
      setResults(stations.filter((station) => station.status === 'UNCLAIMED'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (prefilledId) router.push(`/dashboard/claim/${prefilledId}`);
  }, [prefilledId, router]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-2xl px-4 pb-8 pt-16 text-center">
        <div className="mb-6 flex items-center justify-center gap-2">
          <Fuel className="h-8 w-8 text-blue-400" />
          <span className="text-2xl font-bold text-slate-100">Fuelify</span>
        </div>

        <h1 className="mb-3 text-3xl font-extrabold leading-tight">
          Your station.
          <br />
          Your prices.
          <br />
          <span className="text-blue-400">Free.</span>
        </h1>

        <p className="mb-8 text-base text-slate-400">
          Thousands of drivers search for gas prices near them every day.
          <br />
          Make sure they find you first.
        </p>

        <div className="mb-10 grid grid-cols-1 gap-3 text-left">
          {[
            {
              icon: <Zap className="h-5 w-5 text-blue-400" />,
              text: "Free visibility on Fuelify's driver app",
            },
            {
              icon: <CheckCircle className="h-5 w-5 text-emerald-400" />,
              text: 'Drivers find you first when you have live prices',
            },
            {
              icon: <Shield className="h-5 w-5 text-blue-400" />,
              text: 'Verified badge builds driver trust',
            },
            {
              icon: <Zap className="h-5 w-5 text-amber-400" />,
              text: '2 minutes to set up - no credit card needed',
            },
          ].map((benefit, i) => (
            <div
              key={i}
              className="flex items-center gap-3 rounded-xl border border-white/8 bg-slate-800/50 px-4 py-3"
            >
              {benefit.icon}
              <span className="text-sm text-slate-200">{benefit.text}</span>
            </div>
          ))}
        </div>

        <h2 className="mb-3 text-lg font-semibold">Search for your gas station</h2>

        <div className="relative mb-2">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && search()}
            placeholder="e.g. 'Marathon Killbuck' or '205 W Front St'"
            className="min-h-[48px] w-full rounded-2xl border border-white/10 bg-slate-800 py-3.5 pl-10 pr-32 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="button"
            onClick={search}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xl bg-blue-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-400"
          >
            Find Station
          </button>
        </div>

        {loading && (
          <div className="flex justify-center py-6">
            <LoadingSpinner />
          </div>
        )}

        {results.length > 0 && (
          <div className="mt-4 space-y-2 text-left">
            {results.map((station) => (
              <button
                key={station._id}
                type="button"
                onClick={() => router.push(`/dashboard/claim/${station._id}`)}
                className="group w-full rounded-2xl border border-white/8 bg-slate-800/60 p-3 text-left transition-all hover:border-blue-500/40 hover:bg-blue-950/20"
              >
                <div className="flex items-center gap-3">
                  <BrandLogo brand={station.brand} size={44} />
                  <div>
                    <p className="font-semibold text-slate-100 group-hover:text-white">{station.name}</p>
                    <p className="text-xs text-slate-400">
                      {station.address.street}, {station.address.city}
                    </p>
                  </div>
                  <span className="ml-auto flex-shrink-0 text-xs font-semibold text-blue-400">Claim →</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ClaimLandingPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950" />}>
      <ClaimLandingPageContent />
    </Suspense>
  );
}
```

────────────────────────────────────────────────────────────────────────────────
### fuelify-frontend/app/login/page.tsx
```tsx
// fuelify-frontend/app/login/page.tsx
export { default } from '@/app/dashboard/login/page';
```

────────────────────────────────────────────────────────────────────────────────
### fuelify-frontend/app/stations/[state]/[slug]/page.tsx
```tsx
// fuelify-frontend/app/stations/[state]/[slug]/page.tsx
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AlertTriangle, ChevronRight, Clock, Globe, MapPin, Phone, Fuel } from 'lucide-react';
import type { PriceHistoryEntry, Station } from '@/types';
import { fetchStationBySlug } from '@/services/api';
import { StatusBadge } from '@/components/ui/Badge';
import { PriceGrid } from '@/components/ui/PriceGrid';
import { BrandLogo } from '@/components/ui/BrandLogo';

interface PageProps {
  params: { state: string; slug: string };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  try {
    const { station } = await fetchStationBySlug(params.slug);
    const price = station.prices?.regular;
    const title = `${station.name} Gas Prices Today | Fuelify`;
    const description =
      station.metaDescription ||
      `${station.name} gas prices today in ${station.address.city}, ${station.address.state}.` +
        (price ? ` Regular ${price.toFixed(2)}/gal.` : ' Check current prices on Fuelify.');

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        type: 'website',
        url: `https://fuelify.com/stations/${params.state}/${params.slug}`,
        images: [
          {
            url: `/api/og?name=${encodeURIComponent(station.name)}&price=${price ?? ''}`,
            width: 1200,
            height: 630,
          },
        ],
      },
      twitter: { card: 'summary_large_image', title, description },
    };
  } catch {
    return { title: 'Gas Station | Fuelify' };
  }
}

export default async function StationPage({ params }: PageProps) {
  let station: Station;
  let priceHistory: PriceHistoryEntry[];

  try {
    const data = await fetchStationBySlug(params.slug);
    station = data.station;
    priceHistory = data.priceHistory;
  } catch {
    notFound();
  }

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'GasStation',
    name: station.name,
    address: {
      '@type': 'PostalAddress',
      streetAddress: station.address.street,
      addressLocality: station.address.city,
      addressRegion: station.address.state,
      postalCode: station.address.zip,
      addressCountry: station.address.country,
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: station.coordinates.coordinates[1],
      longitude: station.coordinates.coordinates[0],
    },
    telephone: station.phone,
    url: station.website,
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: 'Fuel Types',
      itemListElement: [
        station.prices?.regular && {
          '@type': 'Offer',
          name: 'Regular Unleaded',
          price: station.prices.regular,
          priceCurrency: 'USD',
        },
        station.prices?.midgrade && {
          '@type': 'Offer',
          name: 'Midgrade Unleaded',
          price: station.prices.midgrade,
          priceCurrency: 'USD',
        },
        station.prices?.premium && {
          '@type': 'Offer',
          name: 'Premium Unleaded',
          price: station.prices.premium,
          priceCurrency: 'USD',
        },
        station.prices?.diesel && {
          '@type': 'Offer',
          name: 'Diesel',
          price: station.prices.diesel,
          priceCurrency: 'USD',
        },
      ].filter(Boolean),
    },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
        <div className="mx-auto max-w-2xl px-4 py-6">

          {/* Breadcrumb */}
          <nav className="mb-6 flex items-center gap-1 text-xs text-[var(--text-muted)]">
            <Link href="/" className="transition-colors hover:text-[var(--accent-primary)]">
              Home
            </Link>
            <ChevronRight className="h-3 w-3" />
            <Link href="/search?state=OH" className="transition-colors hover:text-[var(--accent-primary)]">
              Ohio
            </Link>
            <ChevronRight className="h-3 w-3" />
            <Link
              href={`/search?q=${station.address.city}&state=OH`}
              className="transition-colors hover:text-[var(--accent-primary)]"
            >
              {station.address.city}
            </Link>
            <ChevronRight className="h-3 w-3" />
            <span className="truncate text-[var(--text-secondary)]">{station.name}</span>
          </nav>

          {/* Station header */}
          <div className="mb-6 flex items-start gap-4">
            <div className="shrink-0 rounded-2xl shadow-[0_4px_16px_rgba(0,0,0,0.12)] overflow-hidden">
              <BrandLogo brand={station.brand} size={72} />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-black leading-tight tracking-tight text-[var(--text-primary)]">
                {station.name}
              </h1>
              <p className="mt-1 flex items-center gap-1.5 text-sm text-[var(--text-secondary)]">
                <MapPin className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)]" />
                {station.address.street}, {station.address.city}, {station.address.state} {station.address.zip}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <StatusBadge status={station.status} size="md" />
              </div>
            </div>
          </div>

          {/* Current Prices */}
          <section className={[
            'mb-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4',
            'shadow-[0_2px_12px_rgba(0,0,0,0.06)] dark:shadow-[0_2px_16px_rgba(0,0,0,0.22)]',
          ].join(' ')}>
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500/10">
                  <Fuel className="h-3.5 w-3.5 text-indigo-500" />
                </span>
                <h2 className="font-bold text-[var(--text-primary)]">Current Prices</h2>
              </div>
              {station.prices?.lastUpdated ? (
                <span className="flex items-center gap-1 text-xs text-[var(--text-muted)]">
                  <Clock className="h-3 w-3" />
                  {new Date(station.prices.lastUpdated).toLocaleDateString()}
                </span>
              ) : (
                <span className="flex items-center gap-1 text-xs text-amber-500">
                  <AlertTriangle className="h-3 w-3" />
                  Not reported yet
                </span>
              )}
            </div>
            <PriceGrid prices={station.prices} size="lg" />
          </section>

          {/* Station Info */}
          <section className={[
            'mb-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4',
            'shadow-[0_2px_12px_rgba(0,0,0,0.06)] dark:shadow-[0_2px_16px_rgba(0,0,0,0.22)]',
          ].join(' ')}>
            <h2 className="mb-3 font-bold text-[var(--text-primary)]">Station Info</h2>
            <div className="space-y-2.5">
              {station.phone && (
                <a
                  href={`tel:${station.phone}`}
                  className="flex items-center gap-2.5 text-sm text-[var(--text-secondary)] transition-colors hover:text-[var(--accent-primary)]"
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--bg-elevated)]">
                    <Phone className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                  </span>
                  {station.phone}
                </a>
              )}
              {station.website && (
                <a
                  href={station.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2.5 text-sm text-[var(--accent-primary)] transition-colors hover:text-[var(--accent-violet)]"
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--bg-elevated)]">
                    <Globe className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                  </span>
                  {station.website.replace(/^https?:\/\//, '')}
                </a>
              )}
              {station.hours && (
                <div className="flex items-start gap-2.5 text-sm text-[var(--text-secondary)]">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--bg-elevated)]">
                    <Clock className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                  </span>
                  {station.hours}
                </div>
              )}
            </div>
          </section>

          {/* Price History */}
          {priceHistory?.length > 0 && (
            <section className={[
              'mb-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4',
              'shadow-[0_2px_12px_rgba(0,0,0,0.06)] dark:shadow-[0_2px_16px_rgba(0,0,0,0.22)]',
            ].join(' ')}>
              <h2 className="mb-3 font-bold text-[var(--text-primary)]">Price History</h2>
              <div className="-mx-1 overflow-x-auto px-1">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[var(--border)]">
                      <th className="pb-2 pr-4 font-semibold text-[var(--text-muted)]">Date</th>
                      <th className="pb-2 pr-3 font-semibold text-[var(--text-muted)]">Reg</th>
                      <th className="pb-2 pr-3 font-semibold text-[var(--text-muted)]">Mid</th>
                      <th className="pb-2 pr-3 font-semibold text-[var(--text-muted)]">Prem</th>
                      <th className="pb-2 font-semibold text-[var(--text-muted)]">Diesel</th>
                    </tr>
                  </thead>
                  <tbody>
                    {priceHistory.map((entry) => (
                      <tr key={entry._id} className="border-b border-[var(--border)] last:border-0">
                        <td className="py-2 pr-4 text-[var(--text-muted)]">
                          {new Date(entry.reportedAt).toLocaleDateString()}
                        </td>
                        <td className="py-2 pr-3 font-semibold tabular-nums text-[var(--text-primary)]">
                          {entry.prices.regular ? `$${entry.prices.regular.toFixed(2)}` : <span className="text-[var(--text-muted)]">—</span>}
                        </td>
                        <td className="py-2 pr-3 font-semibold tabular-nums text-[var(--text-primary)]">
                          {entry.prices.midgrade ? `$${entry.prices.midgrade.toFixed(2)}` : <span className="text-[var(--text-muted)]">—</span>}
                        </td>
                        <td className="py-2 pr-3 font-semibold tabular-nums text-[var(--text-primary)]">
                          {entry.prices.premium ? `$${entry.prices.premium.toFixed(2)}` : <span className="text-[var(--text-muted)]">—</span>}
                        </td>
                        <td className="py-2 font-semibold tabular-nums text-[var(--text-primary)]">
                          {entry.prices.diesel ? `$${entry.prices.diesel.toFixed(2)}` : <span className="text-[var(--text-muted)]">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Unclaimed CTA */}
          {station.status === 'UNCLAIMED' && (
            <div className={[
              'mb-6 rounded-2xl border border-amber-500/25 bg-amber-500/10 p-5 text-center',
              'shadow-[0_2px_16px_rgba(245,158,11,0.12)]',
            ].join(' ')}>
              <h3 className="mb-1 font-black text-amber-500">Own this station?</h3>
              <p className="mb-4 text-sm text-[var(--text-secondary)]">
                Claim your free page and start showing real-time prices to drivers in your area.
              </p>
              <Link
                href={`/claim?stationId=${station._id}`}
                className={[
                  'inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-bold text-white',
                  'bg-gradient-to-r from-amber-500 to-orange-500',
                  'shadow-[0_2px_12px_rgba(245,158,11,0.40)]',
                  'transition-all duration-200 hover:brightness-110 active:scale-95',
                ].join(' ')}
              >
                Claim this page — it&apos;s free →
              </Link>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
```

────────────────────────────────────────────────────────────────────────────────
### fuelify-frontend/app/dashboard/page.tsx
```tsx
// fuelify-frontend/app/dashboard/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Clock3, Eye, Fuel, Trophy } from 'lucide-react';
import type { DashboardAnalytics } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import { getAnalytics, updatePrices } from '@/services/api';
import { Sidebar, MobileTabBar } from '@/components/dashboard/Sidebar';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';

interface PriceForm {
  regular: string;
  midgrade: string;
  premium: string;
  diesel: string;
}

export default function DashboardHomePage() {
  const { station, loading } = useAuth();
  const { show } = useToast();
  const [analytics, setAnalytics] = useState<DashboardAnalytics | null>(null);
  const [saving, setSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PriceForm>();

  useEffect(() => {
    if (!station) return;
    reset({
      regular: station.prices?.regular?.toFixed(3) ?? '',
      midgrade: station.prices?.midgrade?.toFixed(3) ?? '',
      premium: station.prices?.premium?.toFixed(3) ?? '',
      diesel: station.prices?.diesel?.toFixed(3) ?? '',
    });
    getAnalytics().then(setAnalytics).catch(console.error);
  }, [reset, station]);

  const statCards = useMemo(
    () => [
      {
        label: 'Regular Price',
        value: station?.prices?.regular ? `$${station.prices.regular.toFixed(2)}` : '--',
        icon: <Fuel className="h-4 w-4" />,
        color: 'text-indigo-500 dark:text-indigo-400',
        bg: 'bg-indigo-500/10',
      },
      {
        label: 'Page Views',
        value: analytics?.viewCount?.toString() || '--',
        icon: <Eye className="h-4 w-4" />,
        color: 'text-emerald-500 dark:text-emerald-400',
        bg: 'bg-emerald-500/10',
      },
      {
        label: 'Last Updated',
        value: station?.prices?.lastUpdated ? new Date(station.prices.lastUpdated).toLocaleDateString() : '--',
        icon: <Clock3 className="h-4 w-4" />,
        color: 'text-amber-500 dark:text-amber-400',
        bg: 'bg-amber-500/10',
      },
      {
        label: 'Area Rank',
        value: analytics?.rankInArea ? `#${analytics.rankInArea}` : '--',
        icon: <Trophy className="h-4 w-4" />,
        color: 'text-violet-500 dark:text-violet-400',
        bg: 'bg-violet-500/10',
      },
    ],
    [analytics?.rankInArea, analytics?.viewCount, station?.prices?.lastUpdated, station?.prices?.regular]
  );

  const onSubmit = async (values: PriceForm) => {
    setSaving(true);
    try {
      const payload: Partial<Record<keyof PriceForm, number>> = {};
      (Object.keys(values) as (keyof PriceForm)[]).forEach((key) => {
        if (!values[key]) return;
        payload[key] = Number.parseFloat(values[key]);
      });
      await updatePrices(payload);
      setLastSavedAt(new Date());
      show("Prices updated. Drivers can see today's rates.", 'success');
      const refreshed = await getAnalytics();
      setAnalytics(refreshed);
    } catch (error: any) {
      show(error.response?.data?.error || 'Price update failed.', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg-primary)]">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="fade-in-up flex min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <Sidebar stationName={station?.name} stationStatus={station?.status} />

      <main className="flex-1 p-4 pb-nav md:p-6 lg:pb-8">
        {/* Page header */}
        <header className="mb-6">
          <p className="text-2xl font-black tracking-tight">Overview</p>
          {station && (
            <p className="mt-0.5 text-sm text-[var(--text-secondary)]">
              {station.name} &middot; {station.address.city}, {station.address.state}
            </p>
          )}
        </header>

        {/* Stat cards */}
        <section className="mb-6">
          <div className="hide-scrollbar grid grid-cols-2 gap-3 sm:grid-cols-4 overflow-x-auto">
            {statCards.map((card) => (
              <Card key={card.label} className="min-w-[150px]">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">{card.label}</p>
                  <span className={['flex h-7 w-7 items-center justify-center rounded-lg', card.bg, card.color].join(' ')}>
                    {card.icon}
                  </span>
                </div>
                <p className="mt-3 text-2xl font-black tabular-nums">{card.value}</p>
              </Card>
            ))}
          </div>
        </section>

        {/* Price update form */}
        <section>
          <Card className="max-w-2xl" padding="lg">
            <div className="mb-5 flex items-start justify-between">
              <div>
                <p className="text-lg font-black">Update Today&apos;s Prices</p>
                <p className="mt-0.5 text-sm text-[var(--text-secondary)]">Drivers see these instantly on the map.</p>
              </div>
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600">
                <Fuel className="h-4 w-4 text-white" />
              </span>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Regular"
                  type="number"
                  step="0.001"
                  placeholder="0.000"
                  prefix="$"
                  error={errors.regular?.message}
                  {...register('regular', {
                    validate: (value) =>
                      !value || (Number.parseFloat(value) > 0 && Number.parseFloat(value) < 20) || '$0.01–$20',
                  })}
                />
                <Input
                  label="Midgrade"
                  type="number"
                  step="0.001"
                  placeholder="0.000"
                  prefix="$"
                  error={errors.midgrade?.message}
                  {...register('midgrade', {
                    validate: (value) =>
                      !value || (Number.parseFloat(value) > 0 && Number.parseFloat(value) < 20) || '$0.01–$20',
                  })}
                />
                <Input
                  label="Premium"
                  type="number"
                  step="0.001"
                  placeholder="0.000"
                  prefix="$"
                  error={errors.premium?.message}
                  {...register('premium', {
                    validate: (value) =>
                      !value || (Number.parseFloat(value) > 0 && Number.parseFloat(value) < 20) || '$0.01–$20',
                  })}
                />
                <Input
                  label="Diesel"
                  type="number"
                  step="0.001"
                  placeholder="0.000"
                  prefix="$"
                  error={errors.diesel?.message}
                  {...register('diesel', {
                    validate: (value) =>
                      !value || (Number.parseFloat(value) > 0 && Number.parseFloat(value) < 20) || '$0.01–$20',
                  })}
                />
              </div>

              <Button type="submit" loading={saving} size="lg" fullWidth>
                Publish Prices
              </Button>
            </form>

            <p className="mt-4 text-xs text-[var(--text-muted)]">
              Last saved: {lastSavedAt ? 'just now' : station?.prices?.lastUpdated ? new Date(station.prices.lastUpdated).toLocaleString() : 'never'}
            </p>
          </Card>
        </section>
      </main>

      <MobileTabBar />
    </div>
  );
}
```

────────────────────────────────────────────────────────────────────────────────
### fuelify-frontend/app/dashboard/login/page.tsx
```tsx
// fuelify-frontend/app/dashboard/login/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { Eye, EyeOff, Fuel, Lock, UserRound } from 'lucide-react';
import { login } from '@/services/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { useToast } from '@/components/ui/Toast';

interface LoginForm {
  identifier: string;
  password: string;
}

export default function LoginPage() {
  const router = useRouter();
  const { show } = useToast();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>();

  const onSubmit = async (values: LoginForm) => {
    setLoading(true);
    try {
      const response = await login(values.identifier, values.password);
      localStorage.setItem('fuelify_token', response.token);
      localStorage.setItem('fuelify_owner', JSON.stringify(response.owner));
      show('Signed in successfully.', 'success');
      router.push('/dashboard');
    } catch (error: any) {
      show(error.response?.data?.error || 'Unable to sign in.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen bg-[var(--bg-primary)]">

      {/* ── Left panel (desktop only) ── */}
      <div className="hidden lg:flex lg:w-[480px] lg:shrink-0 lg:flex-col lg:justify-between lg:overflow-hidden lg:relative">
        {/* Gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700" />
        <div className="absolute inset-0 opacity-30" style={{ backgroundImage: 'radial-gradient(circle at 30% 50%, rgba(255,255,255,0.15) 0%, transparent 60%)' }} />

        <div className="relative z-10 p-10">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm">
              <Fuel className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-black text-white tracking-tight">Fuelify</span>
          </div>
        </div>

        <div className="relative z-10 px-10 pb-10">
          <p className="mb-3 text-3xl font-black text-white leading-tight">
            Your station,<br />your prices.
          </p>
          <p className="text-white/70 text-sm leading-relaxed">
            Log in to update fuel prices in real-time and attract more drivers to your station.
          </p>

          <div className="mt-8 grid grid-cols-2 gap-4">
            {[
              { label: 'Live price updates', icon: '⚡' },
              { label: 'Driver analytics', icon: '📊' },
              { label: 'Station profile', icon: '🏪' },
              { label: 'Free forever', icon: '✅' },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2.5 backdrop-blur-sm">
                <span className="text-base">{item.icon}</span>
                <span className="text-xs font-semibold text-white/90">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right panel / form ── */}
      <div className="fade-in-up flex flex-1 flex-col items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-[400px]">

          {/* Mobile logo */}
          <div className="mb-8 flex flex-col items-center lg:hidden">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-[0_4px_20px_rgba(99,102,241,0.40)]">
              <Fuel className="h-6 w-6 text-white" />
            </div>
            <p className="text-2xl font-black">Fuelify</p>
          </div>

          <div className="mb-8">
            <p className="text-2xl font-black text-[var(--text-primary)]">Welcome back</p>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">Sign in to your station portal</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input
              label="Email or Phone"
              placeholder="you@station.com"
              error={errors.identifier?.message}
              icon={<UserRound className="h-4 w-4" />}
              {...register('identifier', { required: 'Required' })}
            />

            <div className="relative">
              <Input
                label="Password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                error={errors.password?.message}
                icon={<Lock className="h-4 w-4" />}
                {...register('password', {
                  required: 'Required',
                  minLength: { value: 8, message: 'Minimum 8 characters' },
                })}
              />
              <button
                type="button"
                onClick={() => setShowPassword((c) => !c)}
                className="absolute right-3 top-[34px] flex h-[52px] w-10 items-center justify-center text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)] focus:outline-none"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            <Button type="submit" fullWidth size="lg" loading={loading} className="mt-2">
              Sign in to Dashboard
            </Button>
          </form>

          <div className="mt-5 text-center">
            <button
              type="button"
              className="text-sm font-semibold text-[var(--text-muted)] transition-colors hover:text-[var(--accent-primary)]"
            >
              Forgot password?
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
```

────────────────────────────────────────────────────────────────────────────────
### fuelify-frontend/app/dashboard/analytics/page.tsx
```tsx
// fuelify-frontend/app/dashboard/analytics/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { Clock, Eye, Search, TrendingUp } from 'lucide-react';
import type { DashboardAnalytics } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import { getAnalytics } from '@/services/api';
import { Sidebar } from '@/components/dashboard/Sidebar';
import { StatCard } from '@/components/dashboard/StatCard';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

export default function AnalyticsPage() {
  const { station, loading } = useAuth();
  const [analytics, setAnalytics] = useState<DashboardAnalytics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);

  useEffect(() => {
    if (station) {
      getAnalytics().then(setAnalytics).catch(console.error).finally(() => setAnalyticsLoading(false));
    }
  }, [station]);

  if (loading || analyticsLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100">
      <Sidebar stationName={station?.name} />

      <main className="flex-1 p-6">
        <h1 className="mb-6 text-xl font-bold">Analytics</h1>

        <div className="mb-6 grid max-w-xl grid-cols-2 gap-3">
          <StatCard
            label="Total Views"
            value={analytics?.viewCount ?? '-'}
            subtext="All-time station page views"
            icon={<Eye className="h-4 w-4" />}
          />
          <StatCard
            label="Search Appearances"
            value={analytics?.searchAppearances ?? '-'}
            subtext="Times shown to drivers"
            icon={<Search className="h-4 w-4" />}
          />
          <StatCard
            label="Area Rank"
            value={analytics?.rankInArea ? `#${analytics.rankInArea}` : '-'}
            subtext="By regular price within 5mi"
            icon={<TrendingUp className="h-4 w-4" />}
            highlight
          />
          <StatCard
            label="Current Regular"
            value={analytics?.currentRegularPrice ? `$${analytics.currentRegularPrice.toFixed(2)}` : '-'}
            subtext="Your current regular price"
            icon={<Clock className="h-4 w-4" />}
          />
        </div>

        {/* Price charts - PHASE 2 STUB */}
        <div className="max-w-xl rounded-2xl border border-dashed border-white/10 bg-slate-800/30 p-8 text-center">
          <p className="text-sm text-slate-500">Price history charts - Phase 2</p>
          <p className="mt-1 text-xs text-slate-600">Line chart per fuel type will render here</p>
        </div>
      </main>
    </div>
  );
}
```

────────────────────────────────────────────────────────────────────────────────
### fuelify-frontend/app/dashboard/prices/page.tsx
```tsx
// fuelify-frontend/app/dashboard/prices/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Clock } from 'lucide-react';
import type { PriceHistoryEntry } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import { getPriceHistory, updatePrices } from '@/services/api';
import { Sidebar } from '@/components/dashboard/Sidebar';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useToast } from '@/components/ui/Toast';

interface PriceForm {
  regular: string;
  midgrade: string;
  premium: string;
  diesel: string;
  e85: string;
}

export default function PricesPage() {
  const { station, loading } = useAuth();
  const { show } = useToast();
  const [history, setHistory] = useState<PriceHistoryEntry[]>([]);
  const [saving, setSaving] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PriceForm>();

  useEffect(() => {
    if (station) {
      reset({
        regular: station.prices?.regular?.toFixed(3) ?? '',
        midgrade: station.prices?.midgrade?.toFixed(3) ?? '',
        premium: station.prices?.premium?.toFixed(3) ?? '',
        diesel: station.prices?.diesel?.toFixed(3) ?? '',
        e85: station.prices?.e85?.toFixed(3) ?? '',
      });

      getPriceHistory().then((r) => setHistory(r.history)).catch(console.error);
    }
  }, [station, reset]);

  const onSubmit = async (data: PriceForm) => {
    setSaving(true);
    try {
      const prices: Record<string, number> = {};
      Object.entries(data).forEach(([key, value]) => {
        if (value) prices[key] = parseFloat(value);
      });

      await updatePrices(prices);
      show('Prices updated successfully!', 'success');
      const response = await getPriceHistory();
      setHistory(response.history);
    } catch (err: any) {
      show(err.response?.data?.error || 'Update failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100">
      <Sidebar stationName={station?.name} />

      <main className="flex-1 p-6">
        <h1 className="mb-6 text-xl font-bold">Update Prices</h1>

        <div className="mb-6 max-w-lg rounded-2xl border border-white/8 bg-slate-800/50 p-5">
          {station?.prices?.lastUpdated && (
            <p className="mb-4 flex items-center gap-1 text-xs text-slate-400">
              <Clock className="h-3.5 w-3.5" />
              Last updated {new Date(station.prices.lastUpdated).toLocaleString()} by{' '}
              {station.prices.updatedBy === 'OWNER' ? 'you' : 'community'}
            </p>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
            {(['regular', 'midgrade', 'premium', 'diesel', 'e85'] as (keyof PriceForm)[]).map((fuel) => (
              <Input
                key={fuel}
                label={fuel.charAt(0).toUpperCase() + fuel.slice(1)}
                type="number"
                step="0.001"
                min="0"
                max="20"
                placeholder="0.000"
                error={errors[fuel]?.message}
                {...register(fuel, {
                  validate: (value) =>
                    !value ||
                    (parseFloat(value) > 0 && parseFloat(value) < 20) ||
                    'Must be between $0.01 and $20.00',
                })}
              />
            ))}

            <Button type="submit" fullWidth loading={saving} size="lg" className="mt-2">
              Update Prices
            </Button>
          </form>
        </div>

        {history.length > 0 && (
          <div className="overflow-x-auto rounded-2xl border border-white/8 bg-slate-800/50 p-4">
            <h2 className="mb-3 font-semibold text-slate-200">Price History (Last 30)</h2>
            <table className="min-w-[480px] w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/8 text-slate-400">
                  {['Date', 'Time', 'Regular', 'Midgrade', 'Premium', 'Diesel', 'E85', 'By'].map((header) => (
                    <th key={header} className="pb-2 pr-4 font-medium">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {history.map((entry) => {
                  const date = new Date(entry.reportedAt);
                  return (
                    <tr key={entry._id} className="border-b border-white/5">
                      <td className="py-2 pr-4 text-slate-400">{date.toLocaleDateString()}</td>
                      <td className="py-2 pr-4 text-slate-400">
                        {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      {(['regular', 'midgrade', 'premium', 'diesel', 'e85'] as const).map((fuel) => (
                        <td key={fuel} className="py-2 pr-4 text-slate-200">
                          {entry.prices[fuel] ? `$${entry.prices[fuel]!.toFixed(2)}` : '-'}
                        </td>
                      ))}
                      <td className="py-2 text-slate-400">{entry.submittedBy?.name || entry.sourceType}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
```

────────────────────────────────────────────────────────────────────────────────
### fuelify-frontend/app/dashboard/profile/page.tsx
```tsx
// fuelify-frontend/app/dashboard/profile/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import type { Station } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import { updateStationProfile } from '@/services/api';
import { Sidebar } from '@/components/dashboard/Sidebar';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useToast } from '@/components/ui/Toast';

// PHASE 2 NOTE: Photo upload field is a stub only - no S3 integration yet.
interface ProfileForm {
  name: string;
  phone: string;
  website: string;
  hours: string;
  street: string;
  city: string;
  state: string;
  zip: string;
}

const SERVICE_LABELS = [
  ['carWash', 'Car Wash'],
  ['airPump', 'Air Pump'],
  ['atm', 'ATM'],
  ['restrooms', 'Restrooms'],
  ['convenience', 'Convenience Store'],
  ['diesel', 'Diesel Pumps'],
  ['evCharging', 'EV Charging'],
] as const;

const DEFAULT_SERVICES: Station['services'] = {
  carWash: false,
  airPump: false,
  atm: false,
  restrooms: false,
  convenience: false,
  diesel: false,
  evCharging: false,
};

export default function ProfilePage() {
  const { station, loading } = useAuth();
  const { show } = useToast();
  const [services, setServices] = useState<Station['services']>(DEFAULT_SERVICES);
  const [saving, setSaving] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ProfileForm>();

  useEffect(() => {
    if (station) {
      reset({
        name: station.name,
        phone: station.phone,
        website: station.website,
        hours: station.hours,
        street: station.address.street,
        city: station.address.city,
        state: station.address.state,
        zip: station.address.zip,
      });
      setServices(station.services ? { ...DEFAULT_SERVICES, ...station.services } : DEFAULT_SERVICES);
    }
  }, [station, reset]);

  const onSubmit = async (data: ProfileForm) => {
    setSaving(true);
    try {
      await updateStationProfile({
        name: data.name,
        phone: data.phone,
        website: data.website,
        hours: data.hours,
        address: {
          street: data.street,
          city: data.city,
          state: data.state,
          zip: data.zip,
          country: 'US',
        },
        services,
      });
      show('Profile updated!', 'success');
    } catch (err: any) {
      show(err.response?.data?.error || 'Update failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100">
      <Sidebar stationName={station?.name} />
      <main className="flex-1 p-6">
        <h1 className="mb-6 text-xl font-bold">Station Profile</h1>

        <form onSubmit={handleSubmit(onSubmit)} className="max-w-lg space-y-5">
          <Input
            label="Station Name"
            {...register('name', { required: 'Required' })}
            error={errors.name?.message}
          />
          <Input label="Phone" type="tel" {...register('phone')} />
          <Input label="Website" type="url" placeholder="https://" {...register('website')} />
          <Input label="Hours" placeholder="e.g. Mon-Fri 6am-10pm" {...register('hours')} />

          <div>
            <p className="mb-3 text-sm font-medium text-slate-300">Address</p>
            <div className="space-y-3">
              <Input
                label="Street"
                {...register('street', { required: 'Required' })}
                error={errors.street?.message}
              />
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="City"
                  {...register('city', { required: 'Required' })}
                  error={errors.city?.message}
                />
                <Input label="State" {...register('state')} />
              </div>
              <Input label="ZIP Code" {...register('zip')} />
            </div>
          </div>

          <div>
            <p className="mb-3 text-sm font-medium text-slate-300">Services Offered</p>
            <div className="grid grid-cols-2 gap-2">
              {SERVICE_LABELS.map(([key, label]) => (
                <label
                  key={key}
                  className="flex cursor-pointer items-center gap-2 rounded-xl border border-white/8 bg-slate-800/50 px-3 py-2.5 transition-colors hover:border-white/15"
                >
                  <input
                    type="checkbox"
                    checked={services[key]}
                    onChange={(e) =>
                      setServices((prev) => ({
                        ...prev,
                        [key]: e.target.checked,
                      }))
                    }
                    className="h-4 w-4 accent-blue-500"
                  />
                  <span className="text-sm text-slate-300">{label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* PHASE 2 STUB: Photo upload */}
          <div className="rounded-2xl border border-dashed border-white/15 bg-slate-800/30 p-6 text-center">
            <p className="text-sm text-slate-500">Photo upload - coming soon (Phase 2)</p>
          </div>

          <Button type="submit" fullWidth loading={saving} size="lg">
            Save Changes
          </Button>
        </form>
      </main>
    </div>
  );
}
```

────────────────────────────────────────────────────────────────────────────────
### fuelify-frontend/app/dashboard/settings/page.tsx
```tsx
// fuelify-frontend/app/dashboard/settings/page.tsx
// PHASE 2 - STUB
'use client';

import { useAuth } from '@/hooks/useAuth';
import { Sidebar } from '@/components/dashboard/Sidebar';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

export default function SettingsPage() {
  const { station, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100">
      <Sidebar stationName={station?.name} />
      <main className="flex-1 p-6">
        <h1 className="mb-4 text-xl font-bold">Settings</h1>

        <div className="max-w-xl rounded-2xl border border-dashed border-white/10 bg-slate-800/30 p-8 text-center">
          <p className="text-sm text-slate-500">Settings - Phase 2</p>
          <p className="mt-1 text-xs text-slate-600">Password change, notification preferences, etc.</p>
        </div>
      </main>
    </div>
  );
}
```

────────────────────────────────────────────────────────────────────────────────
### fuelify-frontend/app/dashboard/claim/[stationId]/page.tsx
```tsx
// fuelify-frontend/app/dashboard/claim/[stationId]/page.tsx
// Multi-step claim flow: 5 steps
// Step 1: Confirm station identity
// Step 2: Enter phone
// Step 3: OTP verification
// Step 4: Set password + name + email
// Step 5: Success
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { CheckCircle } from 'lucide-react';
import { inititateClaim, resendOtp, verifyClaim } from '@/services/api';
import type { Station } from '@/types';
import { BrandLogo } from '@/components/ui/BrandLogo';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { OtpInput } from '@/components/ui/OtpInput';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useToast } from '@/components/ui/Toast';

// NOTE: This page fetches station by _id.
// Add an alternate GET /api/stations/id/:id route in stations.js that looks up by _id.
type Step = 1 | 2 | 3 | 4 | 5;

export default function ClaimFlowPage() {
  const { stationId } = useParams<{ stationId: string }>();
  const router = useRouter();
  const { show } = useToast();

  const [step, setStep] = useState<Step>(1);
  const [station, setStation] = useState<Station | null>(null);
  const [loadingStation, setLoadingStation] = useState(true);
  const [phone, setPhone] = useState('');
  const [otpError, setOtpError] = useState('');
  const [otp, setOtp] = useState('');
  const [resendCountdown, setResendCountdown] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<{
    name: string;
    email: string;
    password: string;
    confirmPassword: string;
  }>();

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/stations/id/${stationId}`)
      .then((response) => response.json())
      .then((data) => setStation(data.station))
      .catch(() => show('Station not found', 'error'))
      .finally(() => setLoadingStation(false));
  }, [show, stationId]);

  useEffect(() => {
    if (resendCountdown <= 0) return;
    const timer = setInterval(() => setResendCountdown((value) => value - 1), 1000);
    return () => clearInterval(timer);
  }, [resendCountdown]);

  const sendOtp = async () => {
    setSubmitting(true);
    try {
      await inititateClaim(stationId, phone);
      setStep(3);
      setResendCountdown(60);
    } catch (err: any) {
      show(err.response?.data?.error || 'Failed to send OTP', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (resendCountdown > 0) return;

    try {
      await resendOtp(phone, stationId);
      setResendCountdown(60);
      show('New OTP sent!', 'success');
    } catch (err: any) {
      show(err.response?.data?.error || 'Failed to resend OTP', 'error');
    }
  };

  const finalizeAccount = async (data: { name: string; email: string; password: string }) => {
    if (!otp) {
      setOtpError('OTP not entered');
      return;
    }

    setSubmitting(true);
    try {
      const res = await verifyClaim({ stationId, phone, otp, ...data });
      localStorage.setItem('fuelify_token', res.token);
      localStorage.setItem('fuelify_owner', JSON.stringify(res.owner));
      setStep(5);
    } catch (err: any) {
      show(err.response?.data?.error || 'Verification failed', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingStation) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!station) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-400">
        Station not found
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-8 text-slate-100">
      <div className="w-full max-w-md">
        <div className="mb-8 flex items-center justify-center gap-1.5">
          {([1, 2, 3, 4] as Step[]).map((s) => (
            <div
              key={s}
              className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                step >= s ? 'bg-blue-500' : 'bg-slate-700'
              }`}
            />
          ))}
        </div>

        <div className="rounded-2xl border border-white/10 bg-slate-800/50 p-6">
          {step === 1 && (
            <div>
              <h1 className="mb-1 text-lg font-bold">Is this your station?</h1>
              <p className="mb-5 text-sm text-slate-400">We found this listing in our database.</p>

              <div className="mb-6 flex items-center gap-3 rounded-xl border border-white/8 bg-slate-800 p-4">
                <BrandLogo brand={station.brand} size={48} />
                <div>
                  <p className="font-semibold text-slate-100">{station.name}</p>
                  <p className="text-sm text-slate-400">
                    {station.address.street}, {station.address.city}, {station.address.state}
                  </p>
                </div>
              </div>

              <div className="flex gap-2">
                <Button fullWidth onClick={() => setStep(2)}>
                  Yes, this is my station →
                </Button>
                <Button fullWidth variant="secondary" onClick={() => router.push('/claim')}>
                  No, search again
                </Button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <h1 className="mb-1 text-lg font-bold">Enter your phone number</h1>
              <p className="mb-5 text-sm text-slate-400">
                We'll send a 6-digit verification code to confirm you own this station.
              </p>

              <Input
                label="Phone Number"
                type="tel"
                placeholder="+1 (555) 000-0000"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />

              <Button
                fullWidth
                loading={submitting}
                onClick={sendOtp}
                className="mt-4"
                disabled={phone.replace(/\D/g, '').length < 10}
              >
                Send Verification Code
              </Button>
            </div>
          )}

          {step === 3 && (
            <div>
              <h1 className="mb-1 text-lg font-bold">Enter your verification code</h1>
              <p className="mb-6 text-sm text-slate-400">Sent to {phone}</p>

              <OtpInput
                onComplete={(value) => {
                  setOtp(value);
                  setOtpError('');
                }}
                error={otpError}
              />

              <div className="mt-4 text-center">
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resendCountdown > 0}
                  className="text-sm text-slate-400 transition-colors hover:text-slate-200 disabled:text-slate-600"
                >
                  {resendCountdown > 0 ? `Resend in ${resendCountdown}s` : 'Resend code'}
                </button>
              </div>

              <Button fullWidth className="mt-4" onClick={() => setStep(4)} disabled={otp.length < 6}>
                Continue →
              </Button>
            </div>
          )}

          {step === 4 && (
            <form onSubmit={handleSubmit(finalizeAccount)}>
              <h1 className="mb-1 text-lg font-bold">Create your account</h1>
              <p className="mb-5 text-sm text-slate-400">You're almost done!</p>

              <div className="space-y-4">
                <Input
                  label="Full Name"
                  placeholder="Jane Smith"
                  error={errors.name?.message}
                  {...register('name', { required: 'Name is required' })}
                />
                <Input
                  label="Email Address"
                  type="email"
                  placeholder="jane@mystation.com"
                  error={errors.email?.message}
                  {...register('email', {
                    required: 'Email is required',
                    pattern: { value: /\S+@\S+\.\S+/, message: 'Invalid email' },
                  })}
                />
                <Input
                  label="Password"
                  type="password"
                  placeholder="Min 8 characters"
                  error={errors.password?.message}
                  {...register('password', {
                    required: 'Password required',
                    minLength: { value: 8, message: 'Min 8 characters' },
                  })}
                />
                <Input
                  label="Confirm Password"
                  type="password"
                  placeholder="Repeat password"
                  error={errors.confirmPassword?.message}
                  {...register('confirmPassword', {
                    validate: (value) => value === watch('password') || 'Passwords do not match',
                  })}
                />
              </div>

              <Button type="submit" fullWidth loading={submitting} className="mt-5">
                Verify & Create Account
              </Button>
            </form>
          )}

          {step === 5 && (
            <div className="py-4 text-center">
              <CheckCircle className="mx-auto mb-4 h-16 w-16 text-emerald-400" />
              <h1 className="mb-2 text-xl font-bold text-emerald-300">You're verified!</h1>
              <p className="mb-6 text-sm text-slate-400">
                {station.name} is now live on Fuelify with an Owner Verified badge.
              </p>
              <Button fullWidth onClick={() => router.push('/dashboard')}>
                Go to Dashboard →
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

────────────────────────────────────────────────────────────────────────────────
### fuelify-frontend/components/ui/Button.tsx
```tsx
// fuelify-frontend/components/ui/Button.tsx
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Spinner } from './Spinner';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  fullWidth?: boolean;
  children: ReactNode;
}

const VARIANTS: Record<string, string> = {
  primary: [
    'bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-bold',
    'shadow-[0_2px_14px_rgba(99,102,241,0.38)]',
    'hover:shadow-[0_4px_22px_rgba(99,102,241,0.55)] hover:brightness-110',
  ].join(' '),
  secondary: [
    'border border-[var(--border-strong)] bg-[var(--bg-elevated)] text-[var(--text-primary)] font-semibold',
    'hover:border-[var(--accent-primary)] hover:bg-[var(--bg-surface)]',
  ].join(' '),
  ghost: 'bg-transparent text-[var(--text-secondary)] font-semibold hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]',
  danger: [
    'bg-gradient-to-r from-red-500 to-rose-600 text-white font-bold',
    'shadow-[0_2px_12px_rgba(239,68,68,0.32)]',
    'hover:shadow-[0_4px_20px_rgba(239,68,68,0.48)] hover:brightness-110',
  ].join(' '),
};

const SIZES: Record<string, string> = {
  sm: 'h-9  rounded-xl px-4  text-sm',
  md: 'h-11 rounded-xl px-5  text-sm',
  lg: 'h-12 rounded-2xl px-7 text-[15px]',
};

export const Button = ({
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  children,
  disabled,
  className = '',
  ...props
}: ButtonProps) => (
  <button
    disabled={disabled || loading}
    className={[
      'inline-flex items-center justify-center gap-2',
      'transition-all duration-200 ease-out active:scale-[0.96]',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-primary)]',
      'disabled:cursor-not-allowed disabled:opacity-40 disabled:pointer-events-none',
      VARIANTS[variant],
      SIZES[size],
      fullWidth ? 'w-full' : '',
      className,
    ].join(' ')}
    {...props}
  >
    {loading && <Spinner size="sm" color="currentColor" />}
    <span>{children}</span>
  </button>
);
```

────────────────────────────────────────────────────────────────────────────────
### fuelify-frontend/components/ui/Card.tsx
```tsx
// fuelify-frontend/components/ui/Card.tsx
import type { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  padding?: 'sm' | 'md' | 'lg';
  hoverable?: boolean;
  onClick?: () => void;
  className?: string;
}

const PADDING: Record<string, string> = {
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
};

export const Card = ({ children, padding = 'md', hoverable, onClick, className = '' }: CardProps) => (
  <div
    onClick={onClick}
    className={[
      'rounded-2xl border border-[var(--border)] bg-[var(--bg-card)]',
      'shadow-[0_1px_8px_rgba(0,0,0,0.06)] dark:shadow-[0_2px_14px_rgba(0,0,0,0.28)]',
      PADDING[padding],
      hoverable
        ? 'cursor-pointer transition-all duration-200 hover:border-[var(--border-strong)] hover:shadow-[0_4px_16px_rgba(99,102,241,0.10)] active:scale-[0.98]'
        : '',
      className,
    ].join(' ')}
  >
    {children}
  </div>
);
```

────────────────────────────────────────────────────────────────────────────────
### fuelify-frontend/components/ui/Input.tsx
```tsx
// fuelify-frontend/components/ui/Input.tsx
import { forwardRef } from 'react';
import type { InputHTMLAttributes, ReactNode } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  icon?: ReactNode;
  prefix?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, icon, prefix, className = '', ...props }, ref) => (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-[12px] uppercase tracking-wide text-[var(--text-secondary)]">{label}</label>
      )}

      <div className="relative">
        {icon && (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]">
            {icon}
          </span>
        )}

        {prefix && (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-semibold text-[var(--text-secondary)]">
            {prefix}
          </span>
        )}

        <input
          ref={ref}
          className={[
            'h-[52px] w-full rounded-xl border bg-[var(--bg-elevated)] px-4 text-[var(--text-primary)]',
            'placeholder:text-[var(--text-muted)] text-sm',
            'transition-all duration-200',
            'focus:outline-none focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[color:rgba(99,102,241,0.18)]',
            error
              ? 'border-[var(--accent-red)] ring-2 ring-[color:rgba(239,68,68,0.15)]'
              : 'border-[var(--border)]',
            icon ? 'pl-10' : '',
            prefix ? 'pl-8' : '',
            className,
          ].join(' ')}
          {...props}
        />
      </div>

      {error && <p className="text-sm text-[var(--accent-red)]">{error}</p>}
      {hint && !error && <p className="text-xs text-[var(--text-secondary)]">{hint}</p>}
    </div>
  )
);

Input.displayName = 'Input';
```

────────────────────────────────────────────────────────────────────────────────
### fuelify-frontend/components/ui/Badge.tsx
```tsx
// fuelify-frontend/components/ui/Badge.tsx
import { CheckCircle2, CircleHelp } from 'lucide-react';
import type { StationStatus } from '@/types';

type BadgeVariant = 'verified' | 'unclaimed' | 'expiring' | 'expired' | 'active';

interface BadgeProps {
  variant: BadgeVariant;
  size?: 'sm' | 'md';
  children?: string;
}

const STYLES: Record<BadgeVariant, string> = {
  verified: 'bg-emerald-500/12 text-emerald-500 border border-emerald-500/25 dark:text-emerald-400 dark:border-emerald-500/30',
  unclaimed: 'bg-amber-500/10 text-amber-600 border border-amber-500/25 dark:text-amber-400 dark:border-amber-500/30',
  expiring:  'bg-amber-500/12 text-amber-600 border border-amber-500/25 dark:text-amber-400 dark:border-amber-500/30',
  expired:   'bg-red-500/10 text-red-500 border border-red-500/25 dark:text-red-400 dark:border-red-500/30',
  active:    'bg-indigo-500/15 text-indigo-600 border border-indigo-500/30 dark:text-indigo-400',
};

const SIZE: Record<string, string> = {
  sm: 'px-2.5 py-0.5 text-[11px]',
  md: 'px-3    py-1   text-xs',
};

const DEFAULT_LABEL: Record<BadgeVariant, string> = {
  verified: 'Verified',
  unclaimed: 'Unclaimed',
  expiring: 'Expiring',
  expired: 'Expired',
  active: 'Active',
};

export const Badge = ({ variant, size = 'sm', children }: BadgeProps) => (
  <span
    className={[
      'inline-flex min-h-6 items-center gap-1 rounded-full font-bold transition-all duration-200',
      STYLES[variant],
      SIZE[size],
    ].join(' ')}
  >
    {variant === 'verified' && <CheckCircle2 className={size === 'sm' ? 'h-3 w-3' : 'h-4 w-4'} />}
    {variant === 'unclaimed' && <CircleHelp className={size === 'sm' ? 'h-3 w-3' : 'h-4 w-4'} />}
    {children || DEFAULT_LABEL[variant]}
  </span>
);

interface StatusBadgeProps {
  status: StationStatus;
  size?: 'sm' | 'md';
}

export const StatusBadge = ({ status, size = 'sm' }: StatusBadgeProps) => {
  if (status === 'VERIFIED') return <Badge variant="verified" size={size}>Verified</Badge>;
  if (status === 'CLAIMED') return <Badge variant="active" size={size}>Claimed</Badge>;
  return <Badge variant="unclaimed" size={size}>Unclaimed</Badge>;
};
```

────────────────────────────────────────────────────────────────────────────────
### fuelify-frontend/components/ui/Toast.tsx
```tsx
// fuelify-frontend/components/ui/Toast.tsx
'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { AlertCircle, CheckCircle2, Info, TriangleAlert, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastRecord {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  show: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue>({ show: () => {} });

const STYLES: Record<ToastType, string> = {
  success: 'border-emerald-500/35 bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-[0_4px_24px_rgba(16,185,129,0.18)]',
  error:   'border-red-500/35    bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-[0_4px_24px_rgba(239,68,68,0.18)]',
  info:    'border-[var(--border-strong)] bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-[0_4px_24px_rgba(99,102,241,0.18)]',
  warning: 'border-amber-500/35  bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-[0_4px_24px_rgba(245,158,11,0.18)]',
};

const ICONS: Record<ToastType, ReactNode> = {
  success: <CheckCircle2 className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />,
  error:   <AlertCircle   className="h-4 w-4 text-red-500 dark:text-red-400" />,
  info:    <Info          className="h-4 w-4 text-indigo-500 dark:text-indigo-400" />,
  warning: <TriangleAlert className="h-4 w-4 text-amber-500 dark:text-amber-400" />,
};

const ToastItem = ({
  toast,
  onClose,
}: {
  toast: ToastRecord;
  onClose: (id: string) => void;
}) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const enter = setTimeout(() => setVisible(true), 10);
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(() => onClose(toast.id), 250);
    }, 4000);

    return () => {
      clearTimeout(enter);
      clearTimeout(timer);
    };
  }, [onClose, toast.id]);

  return (
    <div
      className={[
        'flex w-[min(92vw,380px)] items-start gap-3 rounded-2xl border px-4 py-3.5',
        'backdrop-blur-sm transition-all duration-300',
        STYLES[toast.type],
        visible ? 'translate-y-0 opacity-100 scale-100' : '-translate-y-2 opacity-0 scale-95',
      ].join(' ')}
    >
      <span className="mt-0.5 shrink-0">{ICONS[toast.type]}</span>
      <p className="flex-1 text-sm font-medium leading-relaxed">{toast.message}</p>
      <button
        type="button"
        onClick={() => onClose(toast.id)}
        className="shrink-0 rounded-lg p-1 text-[var(--text-muted)] transition-colors duration-200 hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)] focus:outline-none"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
};

export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);

  const show = useCallback((message: string, type: ToastType = 'info') => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setToasts((current) => [...current, { id, message, type }]);
  }, []);

  const remove = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const contextValue = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <div className="fixed left-1/2 top-3 z-[1300] flex -translate-x-1/2 flex-col gap-2 sm:left-auto sm:right-4 sm:top-4 sm:translate-x-0">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onClose={remove} />
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => useContext(ToastContext);
```

────────────────────────────────────────────────────────────────────────────────
### fuelify-frontend/components/ui/BottomSheet.tsx
```tsx
// fuelify-frontend/components/ui/BottomSheet.tsx
'use client';

import { useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  snapPoints?: Array<number | string>;
}

const normalizeHeight = (value: number | string) => (typeof value === 'number' ? `${value}px` : value);

export const BottomSheet = ({
  isOpen,
  onClose,
  title,
  children,
  snapPoints = [120, '50vh', '90vh'],
}: BottomSheetProps) => {
  const startY = useRef<number | null>(null);
  const [snapIndex, setSnapIndex] = useState(0);

  const heights = useMemo(() => snapPoints.map(normalizeHeight), [snapPoints]);

  const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    startY.current = event.touches[0].clientY;
  };

  const handleTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    if (startY.current === null) return;
    const delta = event.changedTouches[0].clientY - startY.current;
    startY.current = null;

    if (delta > 100 && snapIndex === 0) {
      onClose();
      return;
    }

    if (delta > 60) {
      setSnapIndex((current) => Math.max(current - 1, 0));
      return;
    }

    if (delta < -60) {
      setSnapIndex((current) => Math.min(current + 1, heights.length - 1));
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px] transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      />

      {/* Sheet */}
      <section
        role="dialog"
        aria-modal="true"
        className={`fixed bottom-0 left-0 right-0 z-50 flex flex-col rounded-t-[28px] border-t border-[var(--border-strong)] bg-[var(--bg-surface)] transition-transform duration-[320ms] cubic-bezier(0.32,0.72,0,1) ${
          isOpen ? 'translate-y-0' : 'translate-y-full'
        }`}
        style={{ height: heights[snapIndex] }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Handle */}
        <div className="flex flex-col items-center pt-3 pb-1 shrink-0">
          <div className="h-[5px] w-10 rounded-full bg-[var(--border-strong)]" />
        </div>

        {title && (
          <header className="shrink-0 border-b border-[var(--border)] px-5 pb-3 pt-1">
            <h3 className="text-base font-bold text-[var(--text-primary)]">{title}</h3>
          </header>
        )}

        <div className="flex-1 overflow-y-auto px-3 pb-safe">{children}</div>
      </section>
    </>
  );
};
```

────────────────────────────────────────────────────────────────────────────────
### fuelify-frontend/components/ui/StationListCard.tsx
```tsx
// fuelify-frontend/components/ui/StationListCard.tsx
import { Navigation } from 'lucide-react';
import type { FuelType, Station } from '@/types';
import { BrandLogo } from './BrandLogo';
import { StatusBadge } from './Badge';

interface StationListCardProps {
  station: Station;
  distance?: number | null;
  selectedFuel: FuelType;
  onClick?: () => void;
}

const formatDistance = (value?: number | null) => {
  if (value === null || value === undefined) return null;
  return `${value.toFixed(1)} mi`;
};

export const StationListCard = ({ station, distance, selectedFuel, onClick }: StationListCardProps) => {
  const price = station.prices?.[selectedFuel];
  const [lng, lat] = station.coordinates.coordinates;
  const navigateUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  const distanceLabel = formatDistance(distance ?? station.distanceKm ?? null);
  const hasPrice = price !== null && price !== undefined;

  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'group relative flex w-full items-center gap-3 rounded-2xl border p-3 text-left',
        'transition-all duration-200 ease-out',
        'hover:border-[var(--border-strong)] hover:shadow-[0_2px_16px_rgba(99,102,241,0.10)]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] active:scale-[0.98]',
        'border-[var(--border)] bg-[var(--bg-card)]',
      ].join(' ')}
    >
      {/* Logo */}
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm">
        <BrandLogo brand={station.brand} size={38} rounded={false} className="border-0 bg-transparent" />
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <p className="truncate text-sm font-bold text-[var(--text-primary)] leading-tight">{station.name}</p>
          {distanceLabel && (
            <span className="shrink-0 rounded-full bg-[var(--bg-elevated)] px-2 py-0.5 text-[10px] font-semibold text-[var(--text-muted)]">
              {distanceLabel}
            </span>
          )}
        </div>
        <p className="mt-0.5 truncate text-xs text-[var(--text-secondary)]">
          {station.address.street}, {station.address.city}
        </p>
        <div className="mt-1.5">
          <StatusBadge status={station.status} size="sm" />
        </div>
      </div>

      {/* Price + Nav */}
      <div className="flex shrink-0 flex-col items-end gap-2">
        <p className={['text-xl font-black tabular-nums leading-none', hasPrice ? 'text-[var(--accent-green)]' : 'text-[var(--text-muted)]'].join(' ')}>
          {hasPrice ? `$${price!.toFixed(2)}` : '--'}
        </p>
        <a
          href={navigateUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(event) => event.stopPropagation()}
          className={[
            'flex h-8 w-8 items-center justify-center rounded-xl',
            'bg-gradient-to-br from-indigo-500 to-violet-600 text-white',
            'shadow-[0_2px_8px_rgba(99,102,241,0.35)]',
            'transition-all duration-200 hover:shadow-[0_4px_14px_rgba(99,102,241,0.50)] active:scale-95',
          ].join(' ')}
        >
          <Navigation className="h-3.5 w-3.5" />
        </a>
      </div>
    </button>
  );
};
```

────────────────────────────────────────────────────────────────────────────────
### fuelify-frontend/components/ui/BrandLogo.tsx
```tsx
// fuelify-frontend/components/ui/BrandLogo.tsx
import Image from 'next/image';
import type { StationBrand } from '@/types';

interface BrandLogoProps {
  brand: StationBrand;
  size?: number;
  rounded?: boolean;
  className?: string;
}

export const BrandLogo = ({ brand, size = 40, rounded = true, className = '' }: BrandLogoProps) => {
  const src = `/logos/${brand}.png`;

  return (
    <div
      className={`flex-shrink-0 overflow-hidden border border-white/10 bg-slate-700 ${
        rounded ? 'rounded-full' : 'rounded-lg'
      } ${className}`}
      style={{ width: size, height: size }}
    >
      <Image
        src={src}
        alt={brand}
        width={size}
        height={size}
        className="h-full w-full object-cover"
        onError={(e) => {
          const img = e.currentTarget as HTMLImageElement;
          img.src = '/logos/default.png';
        }}
      />
    </div>
  );
};
```

────────────────────────────────────────────────────────────────────────────────
### fuelify-frontend/components/ui/OtpInput.tsx
```tsx
// fuelify-frontend/components/ui/OtpInput.tsx
'use client';

import { useRef, useState } from 'react';
import type { ClipboardEvent, KeyboardEvent } from 'react';

interface OtpInputProps {
  length?: number;
  onComplete: (otp: string) => void;
  error?: string;
}

export const OtpInput = ({ length = 6, onComplete, error }: OtpInputProps) => {
  const [values, setValues] = useState<string[]>(Array(length).fill(''));
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const update = (index: number, char: string) => {
    const next = [...values];
    next[index] = char.slice(-1);
    setValues(next);

    if (char && index < length - 1) inputRefs.current[index + 1]?.focus();

    const joined = next.join('');
    if (joined.length === length && !next.includes('')) onComplete(joined);
  };

  const handleKey = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !values[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);

    const next = [...values];
    pasted.split('').forEach((char, i) => {
      next[i] = char;
    });

    setValues(next);
    inputRefs.current[Math.min(pasted.length, length - 1)]?.focus();

    if (pasted.length === length) onComplete(pasted);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-center gap-2">
        {Array.from({ length }).map((_, i) => (
          <input
            key={i}
            ref={(el) => {
              inputRefs.current[i] = el;
            }}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={values[i]}
            onChange={(e) => update(i, e.target.value.replace(/\D/g, ''))}
            onKeyDown={(e) => handleKey(i, e)}
            onPaste={handlePaste}
            className={`h-14 w-12 rounded-xl border-2 bg-slate-800 text-center text-xl font-bold text-slate-100 outline-none transition-all focus:ring-2 focus:ring-blue-500 ${
              error ? 'border-red-500' : values[i] ? 'border-blue-500' : 'border-white/10'
            }`}
          />
        ))}
      </div>

      {error && <p className="text-center text-sm text-red-400">{error}</p>}
    </div>
  );
};
```

────────────────────────────────────────────────────────────────────────────────
### fuelify-frontend/components/ui/PriceGrid.tsx
```tsx
// fuelify-frontend/components/ui/PriceGrid.tsx
import type { FuelType, StationPrices } from '@/types';

interface PriceGridProps {
  prices: StationPrices;
  highlightedFuel?: FuelType;
  size?: 'sm' | 'lg';
}

const LABELS: Record<FuelType, string> = {
  regular: 'Regular',
  midgrade: 'Mid',
  premium: 'Premium',
  diesel: 'Diesel',
  e85: 'E85',
};

const FUELS: FuelType[] = ['regular', 'midgrade', 'premium', 'diesel'];

export const PriceGrid = ({ prices, highlightedFuel, size = 'sm' }: PriceGridProps) => (
  <div className="grid grid-cols-4 gap-1.5">
    {FUELS.map((fuel) => {
      const price = prices[fuel];
      const isHighlighted = fuel === highlightedFuel;

      return (
        <div
          key={fuel}
          className={`flex flex-col items-center rounded-lg border p-2 transition-colors ${
            isHighlighted
              ? 'border-blue-500/30 bg-blue-500/15'
              : 'border-white/5 bg-slate-800/60'
          }`}
        >
          <span
            className={`mb-0.5 uppercase tracking-wide text-slate-400 ${
              size === 'lg' ? 'text-xs' : 'text-[10px]'
            }`}
          >
            {LABELS[fuel]}
          </span>
          <span
            className={`font-bold tabular-nums ${size === 'lg' ? 'text-xl' : 'text-sm'} ${
              isHighlighted ? 'text-blue-300' : price ? 'text-slate-100' : 'text-slate-600'
            }`}
          >
            {price ? `$${price.toFixed(2)}` : '-'}
          </span>
        </div>
      );
    })}
  </div>
);
```

────────────────────────────────────────────────────────────────────────────────
### fuelify-frontend/components/ui/PriceCard.tsx
```tsx
// fuelify-frontend/components/ui/PriceCard.tsx
import type { FuelType } from '@/types';

interface PriceCardProps {
  fuelType: FuelType;
  price: number | null | undefined;
  isSelected?: boolean;
  isLowest?: boolean;
  isFeatured?: boolean;
}

const LABELS: Record<FuelType, string> = {
  regular: 'Regular',
  midgrade: 'Midgrade',
  premium: 'Premium',
  diesel: 'Diesel',
  e85: 'E85',
};

export const PriceCard = ({
  fuelType,
  price,
  isSelected = false,
  isLowest = false,
  isFeatured = false,
}: PriceCardProps) => (
  <div
    className={[
      'relative min-h-[92px] rounded-xl border p-3 transition-all duration-200',
      isLowest
        ? 'border-emerald-500 bg-emerald-500/10'
        : isSelected
          ? 'border-[var(--accent-blue)] bg-[var(--bg-elevated)]'
          : 'border-[var(--border)] bg-[var(--bg-card)]',
      isFeatured ? 'shadow-lg shadow-[color:rgb(59_130_246_/_0.2)]' : '',
    ].join(' ')}
  >
    {isLowest && (
      <span className="absolute right-2 top-2 rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-bold text-white">
        🔥 Best
      </span>
    )}
    <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">{LABELS[fuelType]}</p>
    <p className="mt-2 text-2xl font-black text-[var(--text-primary)]">{price ? `$${price.toFixed(2)}` : '--'}</p>
  </div>
);
```

────────────────────────────────────────────────────────────────────────────────
### fuelify-frontend/components/ui/Spinner.tsx
```tsx
// fuelify-frontend/components/ui/Spinner.tsx
import type { CSSProperties } from 'react';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  color?: string;
  className?: string;
}

const SIZE_MAP: Record<NonNullable<SpinnerProps['size']>, number> = {
  sm: 16,
  md: 24,
  lg: 40,
};

export const Spinner = ({ size = 'md', color = 'var(--accent-blue)', className = '' }: SpinnerProps) => {
  const dimension = SIZE_MAP[size];
  const style: CSSProperties = {
    width: dimension,
    height: dimension,
    borderColor: 'transparent',
    borderTopColor: color,
    borderRightColor: color,
  };

  return <span className={`inline-block animate-spin rounded-full border-2 ${className}`} style={style} />;
};
```

────────────────────────────────────────────────────────────────────────────────
### fuelify-frontend/components/ui/LoadingSpinner.tsx
```tsx
// fuelify-frontend/components/ui/LoadingSpinner.tsx
import { Spinner } from './Spinner';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const LoadingSpinner = ({ size = 'md', className = '' }: LoadingSpinnerProps) => (
  <Spinner size={size} className={className} />
);

export const PageLoader = () => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80">
    <div className="flex flex-col items-center gap-3">
      <LoadingSpinner size="lg" />
      <span className="text-sm text-slate-400">Loading...</span>
    </div>
  </div>
);
```

────────────────────────────────────────────────────────────────────────────────
### fuelify-frontend/components/map/MapView.tsx
```tsx
// fuelify-frontend/components/map/MapView.tsx
'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Station, FuelType } from '@/types';
import { useTheme } from '@/components/theme/ThemeContext';

const MapContainer = dynamic(() => import('react-leaflet').then((m) => m.MapContainer), { ssr: false });
const TileLayer    = dynamic(() => import('react-leaflet').then((m) => m.TileLayer),    { ssr: false });
const Marker       = dynamic(() => import('react-leaflet').then((m) => m.Marker),       { ssr: false });
const useMap       = dynamic(() => import('react-leaflet').then((m) => m.useMap),       { ssr: false });

// ─── Inner component to pan map without full remount ─────
function MapController({ center }: { center: [number, number] }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { useMap: _useMap } = require('react-leaflet');
  const map = _useMap();
  useEffect(() => {
    map.setView(center, map.getZoom(), { animate: true, duration: 0.6 });
  }, [center, map]);
  return null;
}

interface MapViewProps {
  stations: Station[];
  selectedFuel: FuelType;
  center: [number, number];
  onStationSelect: (station: Station) => void;
  selectedStationId?: string;
}

export const MapView = ({ stations, selectedFuel, center, onStationSelect, selectedStationId }: MapViewProps) => {
  const [L, setL] = useState<typeof import('leaflet') | null>(null);
  const { theme } = useTheme();
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    import('leaflet').then((leaflet) => {
      const leafletInstance = leaflet.default || leaflet;
      // Fix default marker icon path issue in Next.js
      delete (leafletInstance.Icon.Default.prototype as any)._getIconUrl;
      leafletInstance.Icon.Default.mergeOptions({
        iconRetinaUrl: '/leaflet/marker-icon-2x.png',
        iconUrl: '/leaflet/marker-icon.png',
        shadowUrl: '/leaflet/marker-shadow.png',
      });
      setL(leafletInstance);
    });
  }, []);

  const priceRanks = stations
    .filter((s) => s.prices?.[selectedFuel] != null)
    .sort((a, b) => (a.prices?.[selectedFuel] ?? Infinity) - (b.prices?.[selectedFuel] ?? Infinity));

  const cheapestId = priceRanks[0]?._id;
  const top3Ids    = new Set(priceRanks.slice(0, 3).map((s) => s._id));

  const createMarkerIcon = useCallback(
    (station: Station) => {
      if (!L) return undefined;

      const price      = station.prices?.[selectedFuel];
      const priceLabel = price != null ? `$${price.toFixed(2)}` : '?';
      const isUnclaimed      = station.status === 'UNCLAIMED';
      const isClaimedNoPrice = station.status === 'CLAIMED' && price == null;
      const isCheapest = station._id === cheapestId;
      const isTop3     = top3Ids.has(station._id);
      const isSelected = station._id === selectedStationId;

      const ringStyle = isSelected
        ? 'box-shadow:0 0 0 3px #6366F1,0 4px 16px rgba(0,0,0,0.22);'
        : '0 4px 16px rgba(0,0,0,0.22);';

      // ── Unclaimed: grey "?" pill ───────────────────────
      if (isUnclaimed) {
        return L.divIcon({
          html: `<div style="
            width:34px;height:34px;border-radius:9999px;
            background:linear-gradient(135deg,#374151,#4B5563);
            display:flex;align-items:center;justify-content:center;
            border:2px solid rgba(255,255,255,0.20);
            color:rgba(255,255,255,0.55);font-size:15px;font-weight:800;
            box-shadow:0 2px 8px rgba(0,0,0,0.28);
            ${isSelected ? 'box-shadow:0 0 0 3px #6366F1,0 2px 8px rgba(0,0,0,0.28);' : ''}
          ">?</div>`,
          className: '',
          iconSize:   [34, 34],
          iconAnchor: [17, 34],
        });
      }

      // ── Claimed but no price yet ───────────────────────
      if (isClaimedNoPrice) {
        return L.divIcon({
          html: `
          <div style="display:flex;flex-direction:column;align-items:center;width:54px;">
            <div style="
              width:54px;height:54px;border-radius:16px;background:white;
              border:2.5px solid rgba(255,255,255,0.9);
              display:flex;align-items:center;justify-content:center;overflow:hidden;
              box-shadow:${ringStyle}
            ">
              <img src="/logos/${station.brand}.png"
                   onerror="this.src='/logos/default.png'"
                   style="width:100%;height:100%;object-fit:cover;" />
            </div>
            <span style="
              margin-top:4px;padding:2px 7px;border-radius:9999px;
              background:linear-gradient(135deg,#F59E0B,#D97706);color:white;
              font-size:10px;font-weight:800;
              box-shadow:0 2px 8px rgba(245,158,11,0.45);
            ">No price</span>
          </div>`,
          className: '',
          iconSize:   [54, 76],
          iconAnchor: [27, 76],
        });
      }

      // ── Verified / Claimed with price ──────────────────
      const badgeBg = isCheapest
        ? 'linear-gradient(135deg,#10B981,#059669)'
        : isTop3
        ? 'linear-gradient(135deg,#6366F1,#8B5CF6)'
        : 'white';
      const badgeColor  = isCheapest || isTop3 ? 'white' : '#0B0F1A';
      const badgeShadow = isCheapest
        ? '0 2px 10px rgba(16,185,129,0.5)'
        : isTop3
        ? '0 2px 10px rgba(99,102,241,0.4)'
        : '0 1px 4px rgba(0,0,0,0.18)';

      return L.divIcon({
        html: `
        <div style="display:flex;flex-direction:column;align-items:center;width:54px;">
          <div class="${isCheapest ? 'marker-pulse' : ''}" style="
            width:54px;height:54px;border-radius:16px;background:white;
            border:2.5px solid rgba(255,255,255,0.9);
            display:flex;align-items:center;justify-content:center;overflow:hidden;
            box-shadow:${isSelected ? '0 0 0 3px #6366F1,' : ''}0 4px 16px rgba(0,0,0,0.22);
          ">
            <img src="/logos/${station.brand}.png"
                 onerror="this.src='/logos/default.png'"
                 style="width:100%;height:100%;object-fit:cover;" />
          </div>
          <span style="
            margin-top:4px;padding:2px 8px;border-radius:9999px;
            background:${badgeBg};color:${badgeColor};
            font-size:11px;font-weight:800;letter-spacing:-0.01em;
            box-shadow:${badgeShadow};white-space:nowrap;
          ">${priceLabel}</span>
        </div>`,
        className: '',
        iconSize:   [54, 76],
        iconAnchor: [27, 76],
      });
    },
    [L, selectedFuel, cheapestId, top3Ids, selectedStationId]
  );

  if (!L) return <div className="h-full w-full skeleton-shimmer" />;

  return (
    <MapContainer
      center={center}
      zoom={12}
      style={{ width: '100%', height: '100%' }}
      zoomControl={false}
      ref={mapRef}
    >
      {/* Smooth pan without remount */}
      <PanController center={center} />

      <TileLayer
        url={
          theme === 'dark'
            ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
            : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'
        }
        attribution='&copy; <a href="https://carto.com">CARTO</a>'
        maxZoom={19}
      />

      {stations.map((station) => {
        const icon = createMarkerIcon(station);
        if (!icon) return null;
        const [lng, lat] = station.coordinates.coordinates;
        if (lat == null || lng == null) return null;

        return (
          <Marker
            key={station._id}
            position={[lat, lng]}
            icon={icon}
            eventHandlers={{ click: () => onStationSelect(station) }}
          />
        );
      })}
    </MapContainer>
  );
};

// ─── Pan controller (inside MapContainer so useMap() works) ──
function PanController({ center }: { center: [number, number] }) {
  // Dynamic import so useMap doesn't run server-side
  const { useMap } = require('react-leaflet');
  const map = useMap();
  const prev = useRef<[number, number]>(center);

  useEffect(() => {
    if (prev.current[0] !== center[0] || prev.current[1] !== center[1]) {
      map.setView(center, map.getZoom(), { animate: true, duration: 0.6 });
      prev.current = center;
    }
  }, [center, map]);

  return null;
}
```

────────────────────────────────────────────────────────────────────────────────
### fuelify-frontend/components/map/BottomSheet.tsx
```tsx
// fuelify-frontend/components/map/BottomSheet.tsx
'use client';

import { useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { ChevronUp } from 'lucide-react';

interface BottomSheetProps {
  children: ReactNode;
  title?: string;
  defaultExpanded?: boolean;
}

// Draggable bottom sheet with touch and mouse support
export const BottomSheet = ({ children, title, defaultExpanded = false }: BottomSheetProps) => {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const startY = useRef(0);
  const isDragging = useRef(false);

  const onTouchStart = (e: React.TouchEvent) => {
    startY.current = e.touches[0].clientY;
    isDragging.current = true;
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (!isDragging.current) return;

    const delta = e.changedTouches[0].clientY - startY.current;
    if (delta < -40) setExpanded(true);
    if (delta > 40) setExpanded(false);
    isDragging.current = false;
  };

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 z-[400] rounded-t-3xl border-t border-white/10 bg-slate-900 shadow-2xl transition-all duration-300 ease-out ${
        expanded ? 'h-[75dvh]' : 'h-[40dvh]'
      }`}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div
        className="cursor-pointer select-none pb-1 pt-3 flex justify-center"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="h-1.5 w-10 rounded-full bg-slate-600" />
      </div>

      {title && (
        <div className="flex items-center justify-between px-4 pb-2">
          <h2 className="text-base font-semibold text-slate-100">{title}</h2>
          <ChevronUp
            className={`h-5 w-5 text-slate-400 transition-transform duration-300 ${
              expanded ? 'rotate-180' : ''
            }`}
          />
        </div>
      )}

      <div className="overscroll-contain h-[calc(100%-52px)] overflow-y-auto px-1 pb-safe">{children}</div>
    </div>
  );
};
```

────────────────────────────────────────────────────────────────────────────────
### fuelify-frontend/components/map/FuelToggle.tsx
```tsx
// fuelify-frontend/components/map/FuelToggle.tsx
'use client';

import type { FuelType } from '@/types';

interface FuelToggleProps {
  selected: FuelType;
  onChange: (fuel: FuelType) => void;
}

const FUELS: { value: FuelType; label: string }[] = [
  { value: 'regular', label: 'Regular' },
  { value: 'midgrade', label: 'Mid' },
  { value: 'premium', label: 'Premium' },
  { value: 'diesel', label: 'Diesel' },
  { value: 'e85', label: 'E85' },
];

export const FuelToggle = ({ selected, onChange }: FuelToggleProps) => (
  <div className="flex overflow-x-auto rounded-2xl border border-white/10 bg-slate-900/90 px-1.5 py-1.5 shadow-xl backdrop-blur-sm gap-1.5">
    {FUELS.map(({ value, label }) => (
      <button
        key={value}
        type="button"
        onClick={() => onChange(value)}
        className={`min-h-[36px] min-w-[64px] flex-shrink-0 rounded-xl px-3.5 py-1.5 text-sm font-semibold transition-all duration-150 ${
          selected === value
            ? 'bg-blue-500 text-white shadow-md shadow-blue-500/30'
            : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
        }`}
      >
        {label}
      </button>
    ))}
  </div>
);
```

────────────────────────────────────────────────────────────────────────────────
### fuelify-frontend/components/map/StationCard.tsx
```tsx
// fuelify-frontend/components/map/StationCard.tsx
import { AlertTriangle, Navigation, Phone } from 'lucide-react';
import type { FuelType, Station } from '@/types';
import { BrandLogo } from '@/components/ui/BrandLogo';
import { PriceGrid } from '@/components/ui/PriceGrid';
import { StatusBadge } from '@/components/ui/Badge';

interface StationCardProps {
  station: Station;
  selectedFuel: FuelType;
  rank?: number;
  onClick?: () => void;
}

const formatDistance = (km?: number) => {
  if (!km) return '';
  if (km < 1) return `${Math.round(km * 1000)}m`;
  return `${km.toFixed(1)}mi`;
};

const getGoogleMapsUrl = (station: Station) =>
  `https://www.google.com/maps/dir/?api=1&destination=${station.coordinates.coordinates[1]},${station.coordinates.coordinates[0]}`;

export const StationCard = ({ station, selectedFuel, rank, onClick }: StationCardProps) => {
  const price = station.prices?.[selectedFuel];
  const isCheapest = rank === 1;

  return (
    <div
      className={`mx-3 mb-2 cursor-pointer rounded-2xl border p-3 transition-all duration-150 active:scale-[0.98] ${
        isCheapest
          ? 'border-emerald-500/30 bg-emerald-950/40'
          : 'border-white/8 bg-slate-800/60 hover:border-white/15'
      }`}
      onClick={onClick}
    >
      <div className="flex items-start gap-3">
        <BrandLogo brand={station.brand} size={44} />

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="truncate text-sm font-semibold leading-tight text-slate-100">{station.name}</p>
              <p className="mt-0.5 text-xs text-slate-400">
                {station.address.city} · {formatDistance(station.distanceKm)}
              </p>
            </div>

            <div className="flex flex-shrink-0 flex-col items-end">
              <span
                className={`text-lg font-bold tabular-nums ${
                  price ? (isCheapest ? 'text-emerald-400' : 'text-slate-100') : 'text-slate-600'
                }`}
              >
                {price ? `$${price.toFixed(2)}` : '-'}
              </span>
              {isCheapest && price && (
                <span className="text-[10px] font-semibold uppercase tracking-wide text-emerald-400">
                  Cheapest
                </span>
              )}
            </div>
          </div>

          <div className="mt-2">
            <PriceGrid prices={station.prices} highlightedFuel={selectedFuel} size="sm" />
          </div>

          <div className="mt-2 flex items-center justify-between">
            <StatusBadge status={station.status} size="sm" />

            <div className="flex gap-1.5">
              {station.phone && (
                <a
                  href={`tel:${station.phone}`}
                  onClick={(e) => e.stopPropagation()}
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-700 text-slate-300 transition-colors hover:text-slate-100"
                >
                  <Phone className="h-3.5 w-3.5" />
                </a>
              )}

              <a
                href={getGoogleMapsUrl(station)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1 rounded-lg border border-blue-500/20 bg-blue-500/15 px-2.5 py-1.5 text-blue-400 transition-colors hover:bg-blue-500/25"
              >
                <Navigation className="h-3 w-3" />
                Navigate
              </a>
            </div>
          </div>

          {station.status === 'UNCLAIMED' && (
            <a
              href={`/claim?stationId=${station._id}`}
              onClick={(e) => e.stopPropagation()}
              className="mt-2 flex items-center gap-1.5 text-xs text-amber-400/80 transition-colors hover:text-amber-400"
            >
              <AlertTriangle className="h-3 w-3" />
              Is this your station? Claim it free →
            </a>
          )}
        </div>
      </div>
    </div>
  );
};
```

────────────────────────────────────────────────────────────────────────────────
### fuelify-frontend/components/dashboard/Sidebar.tsx
```tsx
// fuelify-frontend/components/dashboard/Sidebar.tsx
'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { BarChart3, Fuel, Home, LogOut, Settings, UserRound } from 'lucide-react';
import type { StationStatus } from '@/types';
import { StatusBadge } from '@/components/ui/Badge';

const NAV = [
  { href: '/dashboard', icon: Home, label: 'Home' },
  { href: '/dashboard/prices', icon: Fuel, label: 'Prices' },
  { href: '/dashboard/profile', icon: UserRound, label: 'Profile' },
  { href: '/dashboard/analytics', icon: BarChart3, label: 'Analytics' },
  { href: '/dashboard/settings', icon: Settings, label: 'Settings' },
];

interface SidebarProps {
  stationName?: string;
  stationStatus?: StationStatus;
}

export const Sidebar = ({ stationName, stationStatus }: SidebarProps) => {
  const pathname = usePathname();
  const router = useRouter();

  const logout = () => {
    localStorage.removeItem('fuelify_token');
    localStorage.removeItem('fuelify_owner');
    router.push('/login');
  };

  return (
    <aside className="hidden min-h-screen w-[240px] shrink-0 flex-col border-r border-[var(--border)] bg-[var(--bg-surface)] lg:flex">
      {/* Logo */}
      <div className="border-b border-[var(--border)] px-6 py-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-[0_2px_10px_rgba(99,102,241,0.40)]">
            <Fuel className="h-4 w-4 text-white" />
          </div>
          <span className="text-lg font-black tracking-tight text-[var(--text-primary)]">Fuelify</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 px-3">
        {NAV.map(({ href, icon: Icon, label }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={[
                'flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition-all duration-200',
                active
                  ? 'bg-gradient-to-r from-indigo-500/15 to-violet-500/10 text-[var(--accent-primary)] shadow-[inset_0_0_0_1px_rgba(99,102,241,0.20)]'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]',
              ].join(' ')}
            >
              <Icon className={['h-4 w-4 transition-colors', active ? 'text-[var(--accent-primary)]' : ''].join(' ')} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-[var(--border)] px-4 py-4">
        {stationName && (
          <p className="truncate text-xs font-semibold text-[var(--text-secondary)] mb-1.5">{stationName}</p>
        )}
        {stationStatus && (
          <div className="mb-3">
            <StatusBadge status={stationStatus} size="sm" />
          </div>
        )}
        <button
          type="button"
          onClick={logout}
          className="flex h-10 w-full items-center gap-2.5 rounded-xl px-3 text-sm font-semibold text-[var(--text-secondary)] transition-all duration-200 hover:bg-red-500/10 hover:text-red-500 active:scale-95"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </aside>
  );
};

export const MobileTabBar = () => {
  const pathname = usePathname();
  return (
    <nav className={[
      'fixed bottom-0 left-0 right-0 z-[900] pb-safe lg:hidden',
      'border-t border-[var(--border)] bg-[var(--bg-surface)]',
      'backdrop-blur-xl',
    ].join(' ')}>
      <div className="grid grid-cols-5 px-1">
        {NAV.map(({ href, icon: Icon, label }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className="flex flex-col items-center justify-center gap-1 py-3 text-[10px] font-semibold transition-all duration-200 active:scale-90"
            >
              {active ? (
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500/20 to-violet-500/15">
                  <Icon className="h-4 w-4 text-[var(--accent-primary)]" />
                </span>
              ) : (
                <Icon className="h-4 w-4 text-[var(--text-muted)]" />
              )}
              <span className={active ? 'text-[var(--accent-primary)]' : 'text-[var(--text-muted)]'}>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};
```

────────────────────────────────────────────────────────────────────────────────
### fuelify-frontend/components/dashboard/StatCard.tsx
```tsx
// fuelify-frontend/components/dashboard/StatCard.tsx
import type { ReactNode } from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  icon?: ReactNode;
  highlight?: boolean;
}

export const StatCard = ({ label, value, subtext, icon, highlight }: StatCardProps) => (
  <div
    className={`flex flex-col gap-1 rounded-2xl border p-4 ${
      highlight ? 'border-blue-500/30 bg-blue-950/20' : 'border-white/8 bg-slate-800/50'
    }`}
  >
    <div className="flex items-center justify-between">
      <span className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</span>
      {icon && <span className="text-slate-500">{icon}</span>}
    </div>

    <p className={`text-2xl font-bold tabular-nums ${highlight ? 'text-blue-300' : 'text-slate-100'}`}>
      {value}
    </p>

    {subtext && <p className="text-xs text-slate-500">{subtext}</p>}
  </div>
);
```

────────────────────────────────────────────────────────────────────────────────
### fuelify-frontend/components/theme/ThemeContext.tsx
```tsx
// fuelify-frontend/components/theme/ThemeContext.tsx
'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Moon, Sun } from 'lucide-react';

type Theme = 'dark' | 'light';

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'dark',
  setTheme: () => {},
  toggleTheme: () => {},
});

const STORAGE_KEY = 'fuelify_theme';

const applyThemeClass = (theme: Theme) => {
  const root = document.documentElement;
  if (theme === 'dark') root.classList.add('dark');
  else root.classList.remove('dark');
};

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setThemeState] = useState<Theme>('dark');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    const initial = stored === 'light' ? 'light' : 'dark';
    setThemeState(initial);
    applyThemeClass(initial);
    setMounted(true);
  }, []);

  const setTheme = (nextTheme: Theme) => {
    setThemeState(nextTheme);
    applyThemeClass(nextTheme);
    window.localStorage.setItem(STORAGE_KEY, nextTheme);
  };

  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark');

  const value = useMemo(
    () => ({
      theme,
      setTheme,
      toggleTheme,
    }),
    [theme]
  );

  return (
    <ThemeContext.Provider value={value}>
      {children}
      {mounted && <ThemeToggleButton theme={theme} onToggle={toggleTheme} />}
    </ThemeContext.Provider>
  );
};

const ThemeToggleButton = ({ theme, onToggle }: { theme: Theme; onToggle: () => void }) => (
  <button
    type="button"
    onClick={onToggle}
    aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
    className={[
      'fixed right-4 top-4 z-[1200]',
      'flex h-10 w-10 items-center justify-center rounded-full',
      'border border-[var(--border-strong)] bg-[var(--bg-surface)]',
      'text-[var(--text-secondary)]',
      'shadow-[0_2px_12px_rgba(0,0,0,0.15)]',
      'transition-all duration-300',
      'hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary)] hover:shadow-[0_4px_20px_rgba(99,102,241,0.28)]',
      'focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]',
      'active:scale-90',
      'sm:right-5 sm:top-5',
    ].join(' ')}
  >
    {theme === 'dark'
      ? <Sun  className="h-4 w-4 transition-transform duration-300" />
      : <Moon className="h-4 w-4 transition-transform duration-300" />}
  </button>
);

export const useTheme = () => useContext(ThemeContext);
```