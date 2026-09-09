export type PerformanceStatsPosition =
  | "top-left"
  | "top-right";

export function resolveStatsOverlayX(
  position: PerformanceStatsPosition,
  viewportWidth: number,
  overlayWidth: number,
  inset: number
): number {
  if (position === "top-right") {
    return Math.max(
      inset,
      viewportWidth - overlayWidth - inset
    );
  }

  return inset;
}
