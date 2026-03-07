// fuelify-frontend/components/ui/Badge.tsx
import { CheckCircle2, CircleHelp } from 'lucide-react';
import type { StationStatus } from '@/types';

type BadgeVariant = 'verified' | 'unclaimed' | 'expiring' | 'expired' | 'active';

interface BadgeProps {
  variant: BadgeVariant;
  size?: 'sm' | 'md';
  children?: string;
}

const STYLES: Record<BadgeVariant, string> = {
  verified: 'bg-emerald-500/12 text-emerald-500 border border-emerald-500/25 dark:text-emerald-400 dark:border-emerald-500/30',
  unclaimed: 'bg-amber-500/10 text-amber-600 border border-amber-500/25 dark:text-amber-400 dark:border-amber-500/30',
  expiring:  'bg-amber-500/12 text-amber-600 border border-amber-500/25 dark:text-amber-400 dark:border-amber-500/30',
  expired:   'bg-red-500/10 text-red-500 border border-red-500/25 dark:text-red-400 dark:border-red-500/30',
  active:    'bg-indigo-500/15 text-indigo-600 border border-indigo-500/30 dark:text-indigo-400',
};

const SIZE: Record<string, string> = {
  sm: 'px-2.5 py-0.5 text-[11px]',
  md: 'px-3    py-1   text-xs',
};

const DEFAULT_LABEL: Record<BadgeVariant, string> = {
  verified: 'Verified',
  unclaimed: 'Unclaimed',
  expiring: 'Expiring',
  expired: 'Expired',
  active: 'Active',
};

export const Badge = ({ variant, size = 'sm', children }: BadgeProps) => (
  <span
    className={[
      'inline-flex min-h-6 items-center gap-1 rounded-full font-bold transition-all duration-200',
      STYLES[variant],
      SIZE[size],
    ].join(' ')}
  >
    {variant === 'verified' && <CheckCircle2 className={size === 'sm' ? 'h-3 w-3' : 'h-4 w-4'} />}
    {variant === 'unclaimed' && <CircleHelp className={size === 'sm' ? 'h-3 w-3' : 'h-4 w-4'} />}
    {children || DEFAULT_LABEL[variant]}
  </span>
);

interface StatusBadgeProps {
  status: StationStatus;
  size?: 'sm' | 'md';
}

export const StatusBadge = ({ status, size = 'sm' }: StatusBadgeProps) => {
  if (status === 'VERIFIED') return <Badge variant="verified" size={size}>Verified</Badge>;
  if (status === 'CLAIMED') return <Badge variant="active" size={size}>Claimed</Badge>;
  return <Badge variant="unclaimed" size={size}>Unclaimed</Badge>;
};
