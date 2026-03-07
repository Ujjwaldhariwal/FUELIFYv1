// fuelify-frontend/services/api.ts
import axios, { AxiosError } from 'axios';
import type {
  ApiError,
  ClaimStatus,
  DashboardAnalytics,
  Owner,
  PriceHistoryEntry,
  Station,
  StationClaimSummary,
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
      if (window.location.pathname.startsWith('/dashboard') || window.location.pathname === '/dashboard/login') {
        window.location.href = '/dashboard/login';
      }
    }
    return Promise.reject(err);
  }
);

export interface ApiErrorInfo {
  message: string;
  code?: string;
  requestId?: string;
  status?: number;
}

export const parseApiError = (error: unknown): ApiErrorInfo => {
  const fallback: ApiErrorInfo = { message: 'Unexpected error' };
  if (!axios.isAxiosError(error)) return fallback;

  const data = (error.response?.data || {}) as Partial<ApiError>;
  return {
    message: data.error || data.message || error.message || fallback.message,
    code: data.code,
    requestId: data.requestId,
    status: error.response?.status,
  };
};

export const formatApiErrorForToast = (error: unknown): string => {
  const parsed = parseApiError(error);
  const suffix = [parsed.code, parsed.requestId ? `ref:${parsed.requestId}` : null].filter(Boolean).join(' | ');
  return suffix ? `${parsed.message} (${suffix})` : parsed.message;
};

// Public: Stations
export const fetchNearbyStations = async (
  lat: number,
  lng: number,
  radius = 25,
  fuel = 'regular',
  limit = 20,
  signal?: AbortSignal
): Promise<StationsResponse> => {
  const { data } = await api.get('/stations', { params: { lat, lng, radius, fuel, limit }, signal });
  return data;
};

export const fetchStationsByViewport = async (
  bbox: { west: number; south: number; east: number; north: number },
  fuel = 'regular',
  limit = 300,
  zoom?: number,
  signal?: AbortSignal
): Promise<StationsResponse & { queryMode?: string }> => {
  const bboxParam = `${bbox.west},${bbox.south},${bbox.east},${bbox.north}`;
  const { data } = await api.get('/stations', {
    params: { bbox: bboxParam, fuel, limit, zoom },
    signal,
  });
  return data;
};

export const fetchStationBySlug = async (
  slug: string
): Promise<{ station: Station; priceHistory: PriceHistoryEntry[] }> => {
  const { data } = await api.get(`/stations/${slug}`);
  return data;
};

export const fetchStationById = async (id: string): Promise<{ station: Station }> => {
  const { data } = await api.get(`/stations/id/${id}`);
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
export const initiateClaim = async (stationId: string, phone: string) => {
  const { data } = await api.post('/auth/claim/initiate', { stationId, phone });
  return data;
};

// Backward compatibility for older frontend call sites.
export const inititateClaim = initiateClaim;

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

export interface ClaimEvidencePayload {
  businessName: string;
  businessRegistrationId: string;
  claimantName: string;
  claimantEmail: string;
  claimantPhone: string;
  website?: string;
}

export interface ClaimMutationResponse {
  claimId?: string;
  status: ClaimStatus;
  reasonCode: string | null;
  message: string;
  retryAt: string | null;
  slaEta: string | null;
  requestId: string;
}

export const submitClaimVerification = async (
  stationId: string,
  evidence: ClaimEvidencePayload
): Promise<ClaimMutationResponse> => {
  const { data } = await api.post('/claims', { stationId, evidence });
  return data;
};

export const getClaimStatus = async (claimId: string): Promise<ClaimMutationResponse> => {
  const { data } = await api.get(`/claims/${claimId}/status`);
  return data;
};

export const retryClaimVerification = async (
  claimId: string,
  evidence?: Partial<ClaimEvidencePayload>
): Promise<ClaimMutationResponse> => {
  const { data } = await api.post(`/claims/${claimId}/retry`, evidence ? { evidence } : undefined);
  return data;
};

export const getStationClaimSummary = async (stationId: string): Promise<StationClaimSummary> => {
  const { data } = await api.get(`/claims/station/${stationId}/summary`);
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
