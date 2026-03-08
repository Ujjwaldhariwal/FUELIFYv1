interface ModeChipProps {
  mode: 'nearby' | 'mapview';
  onToggle: () => void;
}

export const ModeChip = ({ mode, onToggle }: ModeChipProps) => {
  const nearbyActive = mode === 'nearby';

  return (
    <div className="inline-flex min-h-[44px] rounded-full border border-[var(--color-border,var(--border))] bg-[var(--bg-surface)] p-1">
      <button
        type="button"
        onClick={onToggle}
        className={[
          'min-h-[44px] rounded-full px-3 text-xs font-semibold transition-all duration-150 sm:text-sm',
          nearbyActive
            ? 'bg-[var(--color-accent,var(--accent-primary))] text-[var(--color-bg-primary,var(--bg-primary))]'
            : 'bg-[var(--color-bg-tertiary,var(--bg-elevated))] text-[var(--color-text-muted,var(--text-muted))]',
        ].join(' ')}
      >
        📍 Near me (10km)
      </button>
      <button
        type="button"
        onClick={onToggle}
        className={[
          'min-h-[44px] rounded-full px-3 text-xs font-semibold transition-all duration-150 sm:text-sm',
          nearbyActive
            ? 'bg-[var(--color-bg-tertiary,var(--bg-elevated))] text-[var(--color-text-muted,var(--text-muted))]'
            : 'bg-[var(--color-accent,var(--accent-primary))] text-[var(--color-bg-primary,var(--bg-primary))]',
        ].join(' ')}
      >
        🗺 Map view
      </button>
    </div>
  );
};

export type { ModeChipProps };
