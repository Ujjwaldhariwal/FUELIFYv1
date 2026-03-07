// fuelify-frontend/components/ui/Button.tsx
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Spinner } from './Spinner';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  fullWidth?: boolean;
  children: ReactNode;
}

const VARIANTS: Record<string, string> = {
  primary: [
    'bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-bold',
    'shadow-[0_2px_14px_rgba(99,102,241,0.38)]',
    'hover:shadow-[0_4px_22px_rgba(99,102,241,0.55)] hover:brightness-110',
  ].join(' '),
  secondary: [
    'border border-[var(--border-strong)] bg-[var(--bg-elevated)] text-[var(--text-primary)] font-semibold',
    'hover:border-[var(--accent-primary)] hover:bg-[var(--bg-surface)]',
  ].join(' '),
  ghost: 'bg-transparent text-[var(--text-secondary)] font-semibold hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]',
  danger: [
    'bg-gradient-to-r from-red-500 to-rose-600 text-white font-bold',
    'shadow-[0_2px_12px_rgba(239,68,68,0.32)]',
    'hover:shadow-[0_4px_20px_rgba(239,68,68,0.48)] hover:brightness-110',
  ].join(' '),
};

const SIZES: Record<string, string> = {
  sm: 'h-9  rounded-xl px-4  text-sm',
  md: 'h-11 rounded-xl px-5  text-sm',
  lg: 'h-12 rounded-2xl px-7 text-[15px]',
};

export const Button = ({
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  children,
  disabled,
  className = '',
  ...props
}: ButtonProps) => (
  <button
    disabled={disabled || loading}
    className={[
      'inline-flex items-center justify-center gap-2',
      'transition-all duration-200 ease-out active:scale-[0.96]',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-primary)]',
      'disabled:cursor-not-allowed disabled:opacity-40 disabled:pointer-events-none',
      VARIANTS[variant],
      SIZES[size],
      fullWidth ? 'w-full' : '',
      className,
    ].join(' ')}
    {...props}
  >
    {loading && <Spinner size="sm" color="currentColor" />}
    <span>{children}</span>
  </button>
);
