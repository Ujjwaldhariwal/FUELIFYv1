// fuelify-frontend/components/ui/Badge.tsx
import { CheckCircle2, CircleHelp, ShieldCheck } from 'lucide-react';
import type { StationStatus } from '@/types';

type BadgeVariant = 'verified' | 'claimed' | 'unclaimed' | 'expiring' | 'expired' | 'active';

interface BadgeProps {
  variant: BadgeVariant;
  size?: 'sm' | 'md';
  children?: string;
}

const STYLES: Record<BadgeVariant, string> = {
  verified:  'bg-[var(--color-success-muted)] text-[var(--color-success)] border border-[color:rgba(16,185,129,0.30)]',
  claimed:   'bg-[rgba(99,102,241,0.10)] text-[#6366f1] border border-[rgba(99,102,241,0.30)] dark:text-[#818cf8] dark:border-[rgba(129,140,248,0.35)]',
  unclaimed: 'bg-[var(--color-warning-muted)] text-[var(--color-warning)] border border-[color:rgba(217,119,6,0.25)]',
  expiring:  'bg-[var(--color-warning-muted)] text-[var(--color-warning)] border border-[color:rgba(217,119,6,0.25)]',
  expired:   'bg-[var(--color-error-muted)] text-[var(--color-error)] border border-[color:rgba(220,38,38,0.25)]',
  active:    'bg-[rgba(99,102,241,0.10)] text-[#6366f1] border border-[rgba(99,102,241,0.30)] dark:text-[#818cf8] dark:border-[rgba(129,140,248,0.35)]',
};

const SIZE: Record<string, string> = {
  sm: 'px-2.5 py-0.5 text-[11px]',
  md: 'px-3    py-1   text-xs',
};

const DEFAULT_LABEL: Record<BadgeVariant, string> = {
  verified:  'Verified',
  claimed:   'Claimed',
  unclaimed: 'Unclaimed',
  expiring:  'Expiring',
  expired:   'Expired',
  active:    'Active',
};

export const Badge = ({ variant, size = 'sm', children }: BadgeProps) => (
  <span
    className={[
      'inline-flex min-h-6 items-center gap-1 rounded-full font-bold transition-all duration-200',
      STYLES[variant],
      SIZE[size],
    ].join(' ')}
  >
    {variant === 'verified'  && <CheckCircle2 className={size === 'sm' ? 'h-3 w-3' : 'h-4 w-4'} />}
    {variant === 'claimed'   && <ShieldCheck  className={size === 'sm' ? 'h-3 w-3' : 'h-4 w-4'} />}
    {variant === 'unclaimed' && <CircleHelp   className={size === 'sm' ? 'h-3 w-3' : 'h-4 w-4'} />}
    {children || DEFAULT_LABEL[variant]}
  </span>
);

interface StatusBadgeProps {
  status: StationStatus;
  size?: 'sm' | 'md';
}

export const StatusBadge = ({ status, size = 'sm' }: StatusBadgeProps) => {
  if (status === 'VERIFIED') return <Badge variant="verified" size={size}>Verified</Badge>;
  if (status === 'CLAIMED')  return <Badge variant="claimed"  size={size}>Claimed</Badge>;
  return <Badge variant="unclaimed" size={size}>Unclaimed</Badge>;
};
