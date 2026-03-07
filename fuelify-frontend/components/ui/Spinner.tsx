// fuelify-frontend/components/ui/Spinner.tsx
import type { CSSProperties } from 'react';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  color?: string;
  className?: string;
}

const SIZE_MAP: Record<NonNullable<SpinnerProps['size']>, number> = {
  sm: 16,
  md: 24,
  lg: 40,
};

export const Spinner = ({ size = 'md', color = 'var(--accent-blue)', className = '' }: SpinnerProps) => {
  const dimension = SIZE_MAP[size];
  const style: CSSProperties = {
    width: dimension,
    height: dimension,
    borderColor: 'transparent',
    borderTopColor: color,
    borderRightColor: color,
  };

  return <span className={`inline-block animate-spin rounded-full border-2 ${className}`} style={style} />;
};
