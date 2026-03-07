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
  code?: string;
  requestId?: string;
  message?: string;
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

export type ClaimStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'BLOCKED';
export type RiskStatus = 'clean' | 'watchlist' | 'blocked';

export interface ClaimSummaryRisk {
  status: RiskStatus;
  score: number;
  reasons: string[];
  evaluatedAt: string | null;
  blockedAt: string | null;
}

export interface ClaimSummaryClaim {
  claimId: string;
  status: ClaimStatus;
  reasonCode: string | null;
  message: string;
  decisionConfidence: number;
  sourceChecks: {
    googleMatch: boolean;
    osmMatch: boolean;
    stateRegistryMatch: boolean;
  };
  retryCount: number;
  retryAt: string | null;
  canRetry: boolean;
  slaEta: string | null;
  decidedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StationClaimSummary {
  stationId: string;
  stationStatus: StationStatus;
  risk: ClaimSummaryRisk;
  claim: ClaimSummaryClaim | null;
  requestId: string;
}
