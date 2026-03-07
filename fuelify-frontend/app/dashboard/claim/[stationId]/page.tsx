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
import {
  fetchStationById,
  formatApiErrorForToast,
  getStationClaimSummary,
  initiateClaim,
  resendOtp,
  submitClaimVerification,
  verifyClaim,
} from '@/services/api';
import type { Station, StationClaimSummary } from '@/types';
import { BrandLogo } from '@/components/ui/BrandLogo';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { OtpInput } from '@/components/ui/OtpInput';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useToast } from '@/components/ui/Toast';

type Step = 1 | 2 | 3 | 4 | 5;

export default function ClaimFlowPage() {
  const { stationId } = useParams<{ stationId: string }>();
  const router = useRouter();
  const { show } = useToast();

  const [step, setStep] = useState<Step>(1);
  const [station, setStation] = useState<Station | null>(null);
  const [claimSummary, setClaimSummary] = useState<StationClaimSummary | null>(null);
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
    businessRegistrationId: string;
    website?: string;
  }>();

  useEffect(() => {
    const load = async () => {
      try {
        const [stationRes, summaryRes] = await Promise.all([
          fetchStationById(stationId),
          getStationClaimSummary(stationId).catch(() => null),
        ]);
        setStation(stationRes.station);
        setClaimSummary(summaryRes);
      } catch (error) {
        show(formatApiErrorForToast(error), 'error');
      } finally {
        setLoadingStation(false);
      }
    };

    load();
  }, [show, stationId]);

  useEffect(() => {
    if (resendCountdown <= 0) return;
    const timer = setInterval(() => setResendCountdown((value) => value - 1), 1000);
    return () => clearInterval(timer);
  }, [resendCountdown]);

  const sendOtp = async () => {
    setSubmitting(true);
    try {
      await initiateClaim(stationId, phone);
      setStep(3);
      setResendCountdown(60);
    } catch (error) {
      show(formatApiErrorForToast(error), 'error');
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
    } catch (error) {
      show(formatApiErrorForToast(error), 'error');
    }
  };

  const finalizeAccount = async (data: {
    name: string;
    email: string;
    password: string;
    businessRegistrationId: string;
    website?: string;
  }) => {
    if (!otp) {
      setOtpError('OTP not entered');
      return;
    }

    setSubmitting(true);
    try {
      const res = await verifyClaim({ stationId, phone, otp, ...data });
      localStorage.setItem('fuelify_token', res.token);
      localStorage.setItem('fuelify_owner', JSON.stringify(res.owner));
      try {
        const claimRes = await submitClaimVerification(stationId, {
          businessName: station?.name || data.name,
          businessRegistrationId: data.businessRegistrationId,
          claimantName: data.name,
          claimantEmail: data.email,
          claimantPhone: phone,
          website: data.website || undefined,
        });
        show(
          `Verification review started (${claimRes.status})`,
          claimRes.status === 'REJECTED' || claimRes.status === 'BLOCKED' ? 'warning' : 'info'
        );
        router.push(
          `/dashboard/claim/status/${stationId}${claimRes.claimId ? `?claimId=${claimRes.claimId}` : ''}`
        );
        return;
      } catch (claimError) {
        show(`Account created. Claim review was not started: ${formatApiErrorForToast(claimError)}`, 'warning');
      }
      setStep(5);
    } catch (error) {
      show(formatApiErrorForToast(error), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const stationBlocked = claimSummary?.risk.status === 'blocked';
  const stationAlreadyClaimed = station?.status !== 'UNCLAIMED';
  const cooldownUntil = claimSummary?.claim?.retryAt ? new Date(claimSummary.claim.retryAt) : null;
  const inCooldown = Boolean(cooldownUntil && cooldownUntil > new Date());

  if (loadingStation) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg-primary)]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!station) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg-primary)] text-[var(--text-secondary)]">
        Station not found
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg-primary)] px-4 py-8 text-[var(--text-primary)]">
      <div className="w-full max-w-md">
        <div className="mb-8 flex items-center justify-center gap-1.5">
          {([1, 2, 3, 4] as Step[]).map((s) => (
            <div
              key={s}
              className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                step >= s ? 'bg-[var(--accent-primary)]' : 'bg-[var(--bg-elevated)]'
              }`}
            />
          ))}
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-6">
          {step === 1 && (
            <div>
              <h1 className="mb-1 text-lg font-bold">Is this your station?</h1>
              <p className="mb-5 text-sm text-[var(--text-secondary)]">We found this listing in our database.</p>

              {stationBlocked && (
                <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                  Claims are temporarily blocked for this station due to verification risk checks.
                </div>
              )}

              {claimSummary?.claim && (
                <div className="mb-4 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-elevated)] px-3 py-2 text-xs text-[var(--text-secondary)]">
                  Latest review: <strong className="text-[var(--text-primary)]">{claimSummary.claim.status}</strong>
                  {claimSummary.claim.reasonCode ? ` - ${claimSummary.claim.reasonCode}` : ''}
                  {inCooldown && cooldownUntil ? ` - retry after ${cooldownUntil.toLocaleString()}` : ''}
                </div>
              )}

              {stationAlreadyClaimed && (
                <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
                  This station is already claimed. Sign in if you are the owner.
                </div>
              )}

              <div className="mb-6 flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4">
                <BrandLogo brand={station.brand} size={48} />
                <div>
                  <p className="font-semibold text-[var(--text-primary)]">{station.name}</p>
                  <p className="text-sm text-[var(--text-secondary)]">
                    {station.address.street}, {station.address.city}, {station.address.state}
                  </p>
                </div>
              </div>

              <div className="flex gap-2">
                <Button fullWidth onClick={() => setStep(2)} disabled={stationBlocked || stationAlreadyClaimed}>
                  Yes, this is my station &rarr;
                </Button>
                <Button fullWidth variant="secondary" onClick={() => router.push('/claim')}>
                  No, search again
                </Button>
              </div>
              {claimSummary?.claim && (
                <Button
                  fullWidth
                  variant="ghost"
                  className="mt-3"
                  onClick={() => router.push(`/dashboard/claim/status/${stationId}`)}
                >
                  Track verification status
                </Button>
              )}
            </div>
          )}

          {step === 2 && (
            <div>
              <h1 className="mb-1 text-lg font-bold">Enter your phone number</h1>
              <p className="mb-5 text-sm text-[var(--text-secondary)]">
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
              <p className="mb-6 text-sm text-[var(--text-secondary)]">Sent to {phone}</p>

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
                  className="text-sm text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)] disabled:text-[var(--text-muted)]"
                >
                  {resendCountdown > 0 ? `Resend in ${resendCountdown}s` : 'Resend code'}
                </button>
              </div>

              <Button fullWidth className="mt-4" onClick={() => setStep(4)} disabled={otp.length < 6}>
                Continue &rarr;
              </Button>
            </div>
          )}

          {step === 4 && (
            <form onSubmit={handleSubmit(finalizeAccount)}>
              <h1 className="mb-1 text-lg font-bold">Create your account</h1>
              <p className="mb-5 text-sm text-[var(--text-secondary)]">You're almost done!</p>

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
                <Input
                  label="Business Registration ID"
                  placeholder="OH-123456"
                  error={errors.businessRegistrationId?.message}
                  {...register('businessRegistrationId', {
                    required: 'Business registration ID is required',
                  })}
                />
                <Input
                  label="Website (Optional)"
                  placeholder="https://yourstation.com"
                  error={errors.website?.message}
                  {...register('website', {
                    pattern: {
                      value: /^$|^https?:\/\/.+/i,
                      message: 'Use a valid URL starting with http:// or https://',
                    },
                  })}
                />
              </div>

              <Button type="submit" fullWidth loading={submitting} className="mt-5">
                Verify and Create Account
              </Button>
            </form>
          )}

          {step === 5 && (
            <div className="py-4 text-center">
              <CheckCircle className="mx-auto mb-4 h-16 w-16 text-[var(--color-success)]" />
              <h1 className="mb-2 text-xl font-bold text-[var(--color-success)]">You're verified!</h1>
              <p className="mb-6 text-sm text-[var(--text-secondary)]">
                {station.name} is now live on Fuelify with an Owner Verified badge.
              </p>
              <Button fullWidth onClick={() => router.push('/dashboard')}>
                Go to Dashboard &rarr;
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
