// fuelify-frontend/components/ui/LoadingSpinner.tsx
import { Spinner } from './Spinner';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const LoadingSpinner = ({ size = 'md', className = '' }: LoadingSpinnerProps) => (
  <Spinner size={size} className={className} />
);

export const PageLoader = () => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--bg-overlay)]">
    <div className="flex flex-col items-center gap-3">
      <LoadingSpinner size="lg" />
      <span className="text-sm text-[var(--text-secondary)]">Loading...</span>
    </div>
  </div>
);
