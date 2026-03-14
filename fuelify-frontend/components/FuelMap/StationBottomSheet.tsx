"use client";

import Link from "next/link";
import { ChevronDown, MapPin } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import type { Station } from "@/types";

interface StationBottomSheetProps {
  station?: Station;
  price: number | null;
  isOpen: boolean;
  onClose: () => void;
}

const SNAP_POINTS = ["30vh", "85vh"] as const;

export const StationBottomSheet = ({
  station,
  price,
  isOpen,
  onClose,
}: StationBottomSheetProps) => {
  const startYRef = useRef<number | null>(null);
  const [snapIndex, setSnapIndex] = useState(0);

  const detailHref = useMemo(() => {
    if (!station) return "#";
    const state = station.address.state.toLowerCase();
    return `/stations/${state}/${station.slug}`;
  }, [station]);

  const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    startYRef.current = event.touches[0]?.clientY ?? null;
  };

  const handleTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    if (startYRef.current === null) return;
    const delta = event.changedTouches[0].clientY - startYRef.current;
    startYRef.current = null;

    if (delta > 90 && snapIndex === 0) {
      onClose();
      return;
    }
    if (delta > 55) {
      setSnapIndex(0);
      return;
    }
    if (delta < -55) {
      setSnapIndex(1);
    }
  };

  return (
    <div className="pointer-events-none md:hidden">
      <div
        onClick={onClose}
        className={`fixed inset-0 z-[640] bg-black/35 transition-opacity duration-300 ${
          isOpen ? "pointer-events-auto opacity-100" : "opacity-0"
        }`}
      />
      <section
        className={`fixed bottom-0 left-0 right-0 z-[650] rounded-t-3xl border-t border-[var(--border)] bg-[var(--bg-card)] shadow-[var(--shadow-sm)] transition-transform duration-300 ${
          isOpen ? "translate-y-0" : "translate-y-full"
        }`}
        style={{ height: SNAP_POINTS[snapIndex], touchAction: "none", userSelect: "none" }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div className="flex justify-center pt-3">
          <button
            type="button"
            onClick={() => setSnapIndex((prev) => (prev === 0 ? 1 : 0))}
            className="rounded-full p-1 text-[var(--text-muted)]"
            aria-label="Expand station details"
          >
            <ChevronDown
              className={`h-5 w-5 transition-transform duration-200 ${
                snapIndex === 1 ? "rotate-180" : ""
              }`}
            />
          </button>
        </div>

        {station ? (
          <div className="px-4 pb-safe">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="truncate text-lg font-black text-[var(--text-primary)]">
                  {station.name}
                </h3>
                <p className="mt-1 flex items-center gap-1.5 text-sm text-[var(--text-secondary)]">
                  <MapPin className="h-3.5 w-3.5" />
                  <span className="truncate">
                    {station.address.street}, {station.address.city}
                  </span>
                </p>
              </div>
              <div className="shrink-0 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-1.5 text-sm font-bold text-[var(--text-primary)]">
                {price !== null ? `$${price.toFixed(3)}` : "Price N/A"}
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-[var(--text-secondary)]">
              <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2">
                Status: <span className="font-semibold text-[var(--text-primary)]">{station.status}</span>
              </div>
              <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2">
                Brand: <span className="font-semibold text-[var(--text-primary)]">{station.brand}</span>
              </div>
            </div>

            <Link
              href={detailHref}
              className="mt-4 inline-flex w-full items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-3 text-sm font-semibold text-[var(--text-primary)] shadow-[var(--shadow-sm)] transition-colors hover:bg-[var(--bg-elevated)]"
            >
              Open Station Details
            </Link>
          </div>
        ) : (
          <div className="px-4 py-8 text-center text-sm text-[var(--text-secondary)]">
            Tap a station marker to view details.
          </div>
        )}
      </section>
    </div>
  );
};

export default StationBottomSheet;
