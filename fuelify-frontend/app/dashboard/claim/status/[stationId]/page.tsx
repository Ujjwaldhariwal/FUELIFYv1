'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { AlertTriangle, CheckCircle2, Clock3, RefreshCcw } from 'lucide-react';
import {
  fetchStationById,
  formatApiErrorForToast,
  getClaimStatus,
  getStationClaimSummary,
  retryClaimVerification,
} from '@/services/api';
import type { StationClaimSummary } from '@/types';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { useToast } from '@/components/ui/Toast';

const STATUS_STYLES: Record<string, string> = {
  APPROVED: 'text-emerald-300 bg-emerald-500/15 border-emerald-500/30',
  PENDING: 'text-blue-300 bg-blue-500/15 border-blue-500/30',
  REJECTED: 'text-amber-200 bg-amber-500/15 border-amber-500/30',
  BLOCKED: 'text-red-300 bg-red-500/15 border-red-500/30',
};

export default function ClaimStatusPage() {
  const { stationId } = useParams<{ stationId: string }>();
  const params = useSearchParams();
  const router = useRouter();
  const { show } = useToast();
  const claimId = params.get('claimId');

  const [summary, setSummary] = useState<StationClaimSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);
  const [businessName, setBusinessName] = useState('');
  const [businessRegistrationId, setBusinessRegistrationId] = useState('');
  const [claimantName, setClaimantName] = useState('');
  const [claimantEmail, setClaimantEmail] = useState('');
  const [claimantPhone, setClaimantPhone] = useState('');
  const [website, setWebsite] = useState('');

  const loadSummary = useCallback(async () => {
    setLoading(true);
    try {
      const [base, station] = await Promise.all([
        getStationClaimSummary(stationId),
        fetchStationById(stationId).catch(() => null),
      ]);
      setSummary(base);
      if (station?.station?.name) {
        setBusinessName((current) => current || station.station.name);
      }
      if (typeof window !== 'undefined') {
        const raw = localStorage.getItem('fuelify_owner');
        if (raw) {
          try {
            const owner = JSON.parse(raw);
            setClaimantName((current) => current || owner?.name || '');
            setClaimantEmail((current) => current || owner?.email || '');
          } catch {
            // ignore malformed storage
          }
        }
      }
      if (claimId) {
        try {
          await getClaimStatus(claimId);
        } catch {
          // keep summary view as source of truth if claimId is stale
        }
      }
    } catch (error) {
      show(formatApiErrorForToast(error), 'error');
    } finally {
      setLoading(false);
    }
  }, [claimId, show, stationId]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    if (!summary?.claim || summary.claim.status !== 'PENDING') return;
    const timer = setInterval(() => {
      loadSummary();
    }, 15000);
    return () => clearInterval(timer);
  }, [loadSummary, summary?.claim]);

  const canRetry = useMemo(() => {
    if (!summary?.claim) return false;
    if (!summary.claim.canRetry) return false;
    return summary.claim.status === 'REJECTED' || summary.claim.status === 'BLOCKED';
  }, [summary]);

  const handleRetry = async () => {
    if (!summary?.claim?.claimId) return;
    if (!businessName || !businessRegistrationId || !claimantName || !claimantEmail || !claimantPhone) {
      show('All required evidence fields must be provided.', 'warning');
      return;
    }
    setRetrying(true);
    try {
      const retry = await retryClaimVerification(summary.claim.claimId, {
        businessName,
        businessRegistrationId,
        claimantName,
        claimantEmail,
        claimantPhone,
        website: website || undefined,
      });
      show(`Retry submitted (${retry.status})`, 'success');
      await loadSummary();
    } catch (error) {
      show(formatApiErrorForToast(error), 'error');
    } finally {
      setRetrying(false);
    }
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--bg-primary)] text-[var(--text-secondary)]">
        Loading claim status...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--bg-primary)] px-4 py-8 text-[var(--text-primary)]">
      <div className="mx-auto max-w-2xl space-y-4">
        <Card className="p-5">
          <h1 className="text-xl font-black">Claim Verification Status</h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Station ID: <span className="font-mono">{stationId}</span>
          </p>
          {summary?.claim ? (
            <div className="mt-4 space-y-3">
              <div
                className={[
                  'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold',
                  STATUS_STYLES[summary.claim.status] || STATUS_STYLES.PENDING,
                ].join(' ')}
              >
                {summary.claim.status === 'APPROVED' && <CheckCircle2 className="h-4 w-4" />}
                {summary.claim.status === 'PENDING' && <Clock3 className="h-4 w-4" />}
                {(summary.claim.status === 'REJECTED' || summary.claim.status === 'BLOCKED') && (
                  <AlertTriangle className="h-4 w-4" />
                )}
                {summary.claim.status}
              </div>
              <p className="text-sm text-[var(--text-secondary)]">{summary.claim.message}</p>
              {summary.claim.reasonCode && (
                <p className="text-xs text-[var(--text-muted)]">Reason: {summary.claim.reasonCode}</p>
              )}
              {summary.claim.retryAt && (
                <p className="text-xs text-[var(--text-muted)]">
                  Retry available: {new Date(summary.claim.retryAt).toLocaleString()}
                </p>
              )}
              {summary.claim.slaEta && (
                <p className="text-xs text-[var(--text-muted)]">
                  SLA ETA: {new Date(summary.claim.slaEta).toLocaleString()}
                </p>
              )}
            </div>
          ) : (
            <p className="mt-3 text-sm text-[var(--text-secondary)]">
              No automated verification claim record found yet.
            </p>
          )}
        </Card>

        {canRetry && (
          <Card className="p-5">
            <h2 className="text-base font-bold">Retry Verification</h2>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              You can submit updated evidence for another verification attempt.
            </p>
            <div className="mt-4 space-y-3">
              <Input
                label="Business Name"
                placeholder="Station legal name"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
              />
              <Input
                label="Business Registration ID"
                placeholder="OH-123456"
                value={businessRegistrationId}
                onChange={(e) => setBusinessRegistrationId(e.target.value)}
              />
              <Input
                label="Claimant Name"
                placeholder="Owner full name"
                value={claimantName}
                onChange={(e) => setClaimantName(e.target.value)}
              />
              <Input
                label="Claimant Email"
                placeholder="owner@station.com"
                type="email"
                value={claimantEmail}
                onChange={(e) => setClaimantEmail(e.target.value)}
              />
              <Input
                label="Claimant Phone"
                placeholder="+15550001111"
                value={claimantPhone}
                onChange={(e) => setClaimantPhone(e.target.value)}
              />
              <Input
                label="Website (Optional)"
                placeholder="https://yourstation.com"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
              />
              <Button fullWidth loading={retrying} onClick={handleRetry}>
                Retry Verification
              </Button>
            </div>
          </Card>
        )}

        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => loadSummary()}>
            <RefreshCcw className="mr-1.5 h-4 w-4" />
            Refresh
          </Button>
          <Button variant="ghost" onClick={() => router.push('/dashboard')}>
            Back to Dashboard
          </Button>
        </div>
      </div>
    </main>
  );
}
