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
      router.push('/dashboard/login');
      return;
    }

    let parsedOwner: Owner | null = null;
    try {
      parsedOwner = JSON.parse(ownerRaw) as Owner;
      setOwner(parsedOwner);
    } catch {
      localStorage.removeItem('fuelify_token');
      localStorage.removeItem('fuelify_owner');
      router.push('/dashboard/login');
      return;
    }

    getDashboardStation()
      .then(({ station: stationData }) => {
        if (stationData.status !== 'VERIFIED') {
          const statusPath = stationData._id
            ? `/dashboard/claim/status/${stationData._id}`
            : '/claim';
          router.push(statusPath);
          return;
        }
        setStation(stationData);
      })
      .catch((error: any) => {
        const status = error?.response?.status;
        const code = error?.response?.data?.code;
        const stationId =
          error?.response?.data?.stationId ||
          parsedOwner?.stationId;

        if (status === 403 && code === 'STATION_NOT_VERIFIED' && stationId) {
          router.push(`/dashboard/claim/status/${stationId}`);
          return;
        }
        localStorage.removeItem('fuelify_token');
        localStorage.removeItem('fuelify_owner');
        router.push('/dashboard/login');
      })
      .finally(() => setLoading(false));
  }, [router]);

  return { owner, station, loading };
};
