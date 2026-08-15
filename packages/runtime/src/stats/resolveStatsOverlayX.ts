export type PerformanceStatsPosition = "top-left" | "top-right";

/** Resolves the horizontal HUD offset while keeping it inside the viewport. */
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
