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
