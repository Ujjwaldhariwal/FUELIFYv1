// fuelify-frontend/components/ui/Input.tsx
import { forwardRef } from 'react';
import type { InputHTMLAttributes, ReactNode } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  icon?: ReactNode;
  prefix?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, icon, prefix, className = '', ...props }, ref) => (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-[12px] uppercase tracking-wide text-[var(--text-secondary)]">{label}</label>
      )}

      <div className="relative">
        {icon && (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]">
            {icon}
          </span>
        )}

        {prefix && (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-semibold text-[var(--text-secondary)]">
            {prefix}
          </span>
        )}

        <input
          ref={ref}
          className={[
            'h-[52px] w-full rounded-xl border bg-[var(--bg-elevated)] px-4 text-[var(--text-primary)]',
            'placeholder:text-[var(--text-muted)] text-sm',
            'transition-all duration-200',
            'focus:outline-none focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[color:rgba(99,102,241,0.18)]',
            error
              ? 'border-[var(--accent-red)] ring-2 ring-[color:rgba(239,68,68,0.15)]'
              : 'border-[var(--border)]',
            icon ? 'pl-10' : '',
            prefix ? 'pl-8' : '',
            className,
          ].join(' ')}
          {...props}
        />
      </div>

      {error && <p className="text-sm text-[var(--accent-red)]">{error}</p>}
      {hint && !error && <p className="text-xs text-[var(--text-secondary)]">{hint}</p>}
    </div>
  )
);

Input.displayName = 'Input';
