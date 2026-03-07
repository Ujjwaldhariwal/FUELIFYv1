// fuelify-frontend/components/ui/Card.tsx
import type { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  padding?: 'sm' | 'md' | 'lg';
  hoverable?: boolean;
  onClick?: () => void;
  className?: string;
}

const PADDING: Record<string, string> = {
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
};

export const Card = ({ children, padding = 'md', hoverable, onClick, className = '' }: CardProps) => (
  <div
    onClick={onClick}
    className={[
      'rounded-2xl border border-[var(--border)] bg-[var(--bg-card)]',
      'shadow-[0_1px_8px_rgba(0,0,0,0.06)] dark:shadow-[0_2px_14px_rgba(0,0,0,0.28)]',
      PADDING[padding],
      hoverable
        ? 'cursor-pointer transition-all duration-200 hover:border-[var(--border-strong)] hover:shadow-[0_4px_16px_rgba(99,102,241,0.10)] active:scale-[0.98]'
        : '',
      className,
    ].join(' ')}
  >
    {children}
  </div>
);
