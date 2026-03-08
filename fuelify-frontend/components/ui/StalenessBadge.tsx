import { Badge } from '@/components/ui/Badge';

export interface StalenessBadgeProps {
  reportedAt: string | Date | null;
  isStale: boolean;
}

const getRelativeLabel = (reportedAt: string | Date) => {
  const reportedMs = new Date(reportedAt).getTime();
  if (!Number.isFinite(reportedMs)) return 'Updated just now';

  const diffMinutes = Math.max(0, Math.floor((Date.now() - reportedMs) / (60 * 1000)));
  if (diffMinutes < 60) return `Updated ${diffMinutes} mins ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  return `Updated ${diffHours} hours ago`;
};

export const StalenessBadge = ({ reportedAt, isStale }: StalenessBadgeProps) => {
  if (!reportedAt) {
    return <p className="text-xs text-[var(--color-text-muted,var(--text-muted))]">No price reported yet</p>;
  }

  if (isStale) {
    return (
      <Badge variant="expiring" size="sm">
        ⚠ Price may be outdated
      </Badge>
    );
  }

  return (
    <Badge variant="verified" size="sm">
      {getRelativeLabel(reportedAt)}
    </Badge>
  );
};
