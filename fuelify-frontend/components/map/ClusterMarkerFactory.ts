//fuelify-frontend/components/map/ClusterMarkerFactory.ts
import type { MarkerColors } from "./MarkerFactory";

export const createClusterMarkerElement = (
  count: number,
  minPrice: number | null,
  colors: MarkerColors,
): HTMLDivElement => {
  const el = document.createElement("div");
  el.className = "fuelify-cluster-marker";
  // We ONLY set cursor here. DO NOT set position: relative on the root element!
  el.style.cursor = "pointer";

  const accent =
    minPrice === null
      ? "#94a3b8"
      : minPrice < 3.0
        ? "#22c55e"
        : minPrice < 3.5
          ? "#f59e0b"
          : "#ef4444";

  const countLabel = count > 99 ? "99+" : String(count);
  const priceLabel = minPrice !== null ? `$${minPrice.toFixed(2)}` : "–––";

  const tooltipHTML = `
    <div class="cluster-tooltip" style="
      position: absolute;
      bottom: 100%;
      margin-bottom: 6px;
      background: ${colors.text};
      color: ${colors.bg};
      padding: 5px 10px;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 600;
      white-space: nowrap;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      opacity: 0;
      visibility: hidden;
      transform: translateY(4px);
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      pointer-events: none;
      z-index: 10;
    ">
      ${count} stations nearby
      <div style="position: absolute; top: 100%; left: 50%; transform: translateX(-50%); border-width: 4px; border-style: solid; border-color: ${colors.text} transparent transparent transparent;"></div>
    </div>
  `;

  const markerHTML = `
    <div style="display: flex; align-items: center; gap: 4px; padding: 3px 7px 3px 3px; background: ${colors.bg}; border: 1.5px solid ${accent}; border-radius: 20px; white-space: nowrap; box-shadow: 0 1px 6px rgba(0,0,0,0.12); transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);" class="cluster-pill">
      <div style="min-width: 20px; height: 20px; padding: 0 4px; border-radius: 10px; background: ${accent}; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
        <span style="font-size: 10px; font-weight: 800; color: #fff; line-height: 1; letter-spacing: -0.03em;">${countLabel}</span>
      </div>
      <span style="font-size: 11.5px; font-weight: 800; color: ${colors.text}; letter-spacing: -0.03em; line-height: 1; font-variant-numeric: tabular-nums;">${priceLabel}</span>
    </div>
    <div style="width: 6px; height: 6px; margin: -3.5px auto 0; background: ${colors.bg}; border-left: 1.5px solid ${accent}; border-bottom: 1.5px solid ${accent}; transform: rotate(-45deg);"></div>
  `;

  // We wrap the contents in an inner div with position: relative!
  el.innerHTML = `
    <div style="position: relative; display: flex; flex-direction: column; align-items: center;">
      ${tooltipHTML}
      ${markerHTML}
    </div>
  `;

  const tooltip = el.querySelector('.cluster-tooltip') as HTMLElement;
  const pill = el.querySelector('.cluster-pill') as HTMLElement;

  el.addEventListener('mouseenter', () => {
    if (tooltip) {
      tooltip.style.opacity = "1";
      tooltip.style.visibility = "visible";
      tooltip.style.transform = "translateY(0)";
    }
    if (pill) {
      pill.style.transform = "scale(1.05)";
    }
  });

  el.addEventListener('mouseleave', () => {
    if (tooltip) {
      tooltip.style.opacity = "0";
      tooltip.style.visibility = "hidden";
      tooltip.style.transform = "translateY(4px)";
    }
    if (pill) {
      pill.style.transform = "scale(1)";
    }
  });

  return el;
};