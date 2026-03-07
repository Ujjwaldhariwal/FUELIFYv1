// fuelify-frontend/components/ui/BottomSheet.tsx
'use client';

import { useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  snapPoints?: Array<number | string>;
}

const normalizeHeight = (value: number | string) => (typeof value === 'number' ? `${value}px` : value);

export const BottomSheet = ({
  isOpen,
  onClose,
  title,
  children,
  snapPoints = [120, '50vh', '90vh'],
}: BottomSheetProps) => {
  const startY = useRef<number | null>(null);
  const [snapIndex, setSnapIndex] = useState(0);

  const heights = useMemo(() => snapPoints.map(normalizeHeight), [snapPoints]);

  const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    startY.current = event.touches[0].clientY;
  };

  const handleTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    if (startY.current === null) return;
    const delta = event.changedTouches[0].clientY - startY.current;
    startY.current = null;

    if (delta > 100 && snapIndex === 0) {
      onClose();
      return;
    }

    if (delta > 60) {
      setSnapIndex((current) => Math.max(current - 1, 0));
      return;
    }

    if (delta < -60) {
      setSnapIndex((current) => Math.min(current + 1, heights.length - 1));
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px] transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      />

      {/* Sheet */}
      <section
        role="dialog"
        aria-modal="true"
        className={`fixed bottom-0 left-0 right-0 z-50 flex flex-col rounded-t-[28px] border-t border-[var(--border-strong)] bg-[var(--bg-surface)] transition-transform duration-[320ms] cubic-bezier(0.32,0.72,0,1) ${
          isOpen ? 'translate-y-0' : 'translate-y-full'
        }`}
        style={{ height: heights[snapIndex] }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Handle */}
        <div className="flex flex-col items-center pt-3 pb-1 shrink-0">
          <div className="h-[5px] w-10 rounded-full bg-[var(--border-strong)]" />
        </div>

        {title && (
          <header className="shrink-0 border-b border-[var(--border)] px-5 pb-3 pt-1">
            <h3 className="text-base font-bold text-[var(--text-primary)]">{title}</h3>
          </header>
        )}

        <div className="flex-1 overflow-y-auto px-3 pb-safe">{children}</div>
      </section>
    </>
  );
};
