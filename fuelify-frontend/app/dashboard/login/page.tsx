// fuelify-frontend/app/dashboard/login/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { Eye, EyeOff, Fuel, Lock, UserRound } from 'lucide-react';
import { formatApiErrorForToast, login } from '@/services/api';
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
      if (response.station?.status !== 'VERIFIED') {
        const stationId = response.station?._id || response.owner?.stationId;
        if (stationId) {
          router.push(`/dashboard/claim/status/${stationId}`);
          return;
        }
      }
      router.push('/dashboard');
    } catch (error) {
      show(formatApiErrorForToast(error), 'error');
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
              onClick={() => show('Password reset coming soon', 'info')}
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
