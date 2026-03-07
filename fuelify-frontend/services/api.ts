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
