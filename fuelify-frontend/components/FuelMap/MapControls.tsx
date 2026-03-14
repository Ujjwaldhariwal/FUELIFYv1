"use client";

import { Compass, LocateFixed, Minus, Plus } from "lucide-react";

interface MapControlsProps {
  bearing: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetBearing: () => void;
  onLocateMe: () => void;
  className?: string;
}

const CONTROL_BUTTON_CLASS = [
  "flex h-10 w-10 items-center justify-center rounded-xl",
  "border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-primary)]",
  "shadow-[var(--shadow-sm)] transition-all duration-200",
  "hover:border-[var(--border)] hover:bg-[var(--bg-elevated)] active:scale-95",
  "focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]",
].join(" ");

export const MapControls = ({
  bearing,
  onZoomIn,
  onZoomOut,
  onResetBearing,
  onLocateMe,
  className,
}: MapControlsProps) => (
  <div className={`pointer-events-auto flex flex-col gap-2 ${className ?? ""}`}>
    <button type="button" className={CONTROL_BUTTON_CLASS} onClick={onZoomIn} aria-label="Zoom in">
      <Plus className="h-4 w-4" />
    </button>
    <button
      type="button"
      className={CONTROL_BUTTON_CLASS}
      onClick={onZoomOut}
      aria-label="Zoom out"
    >
      <Minus className="h-4 w-4" />
    </button>
    <button
      type="button"
      className={CONTROL_BUTTON_CLASS}
      onClick={onResetBearing}
      aria-label="Reset map bearing"
      title="Reset orientation"
    >
      <Compass
        className="h-4 w-4 transition-transform duration-300"
        style={{ transform: `rotate(${-bearing}deg)` }}
      />
    </button>
    <button
      type="button"
      className={CONTROL_BUTTON_CLASS}
      onClick={onLocateMe}
      aria-label="Near me"
      title="Near me"
    >
      <LocateFixed className="h-4 w-4" />
    </button>
  </div>
);

export default MapControls;
