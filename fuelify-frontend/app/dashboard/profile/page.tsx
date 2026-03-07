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
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg-primary)]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
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
            <p className="mb-3 text-sm font-medium text-[var(--text-secondary)]">Address</p>
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
            <p className="mb-3 text-sm font-medium text-[var(--text-secondary)]">Services Offered</p>
            <div className="grid grid-cols-2 gap-2">
              {SERVICE_LABELS.map(([key, label]) => (
                <label
                  key={key}
                  className="flex cursor-pointer items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2.5 transition-colors hover:border-[var(--border-strong)]"
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
                    className="h-4 w-4 accent-indigo-500"
                  />
                  <span className="text-sm text-[var(--text-secondary)]">{label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* PHASE 2 STUB: Photo upload */}
          <div className="rounded-2xl border border-dashed border-[var(--border-strong)] bg-[var(--bg-card)] p-6 text-center">
            <p className="text-sm text-[var(--text-muted)]">Station photo upload coming soon</p>
          </div>

          <Button type="submit" fullWidth loading={saving} size="lg">
            Save Changes
          </Button>
        </form>
      </main>
    </div>
  );
}
