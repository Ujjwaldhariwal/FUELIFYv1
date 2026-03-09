import { Navigation, Map } from 'lucide-react';

interface ModeChipProps {
  mode: 'nearby' | 'mapview';
  onToggle: () => void;
}

export const ModeChip = ({ mode, onToggle }: ModeChipProps) => {
  const nearbyActive = mode === 'nearby';

  const btnBase = [
    'flex min-h-[38px] items-center gap-1.5 rounded-full px-3',
    'text-xs font-semibold transition-all duration-150 sm:text-sm',
    'focus:outline-none active:scale-95',
  ].join(' ');

  const activeBtn   = 'bg-[var(--accent-primary)] text-white shadow-[var(--shadow-accent)]';
  const inactiveBtn = 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]';

  return (
    <div className="inline-flex rounded-full border border-[var(--border-strong)] bg-[var(--bg-surface)] p-1 shadow-[var(--shadow-sm)]">
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={nearbyActive}
        className={[btnBase, nearbyActive ? activeBtn : inactiveBtn].join(' ')}
      >
        <Navigation className="h-3.5 w-3.5 shrink-0" />
        <span className="hidden sm:inline">Near me</span>
        <span className="sm:hidden">Near</span>
      </button>
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={!nearbyActive}
        className={[btnBase, !nearbyActive ? activeBtn : inactiveBtn].join(' ')}
      >
        <Map className="h-3.5 w-3.5 shrink-0" />
        <span className="hidden sm:inline">Map view</span>
        <span className="sm:hidden">Map</span>
      </button>
    </div>
  );
};

export type { ModeChipProps };
