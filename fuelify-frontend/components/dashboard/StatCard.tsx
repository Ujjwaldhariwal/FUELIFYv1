// fuelify-frontend/components/dashboard/StatCard.tsx
import type { ReactNode } from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  icon?: ReactNode;
  highlight?: boolean;
}

export const StatCard = ({ label, value, subtext, icon, highlight }: StatCardProps) => (
  <div
    className={`flex flex-col gap-1 rounded-2xl border p-4 ${
      highlight ? 'border-[var(--border-strong)] bg-[var(--color-info-muted)]' : 'border-[var(--border)] bg-[var(--bg-card)]'
    }`}
  >
    <div className="flex items-center justify-between">
      <span className="text-xs font-medium uppercase tracking-wide text-[var(--text-secondary)]">{label}</span>
      {icon && <span className="text-[var(--text-muted)]">{icon}</span>}
    </div>

    <p className={`text-2xl font-bold tabular-nums ${highlight ? 'text-[var(--accent-primary)]' : 'text-[var(--text-primary)]'}`}>
      {value}
    </p>

    {subtext && <p className="text-xs text-[var(--text-muted)]">{subtext}</p>}
  </div>
);
