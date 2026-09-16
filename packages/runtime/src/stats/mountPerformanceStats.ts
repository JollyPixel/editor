// Import Third-party Dependencies
import type { StatsRecorder } from "@jolly-pixel/ui/stats";

// Import Internal Dependencies
import type { OverlayLayer } from "../ui/overlay/OverlayLayer.ts";
import type { OverlayPosition } from "../ui/overlay/resolveOverlayAnchor.ts";

// CONSTANTS
const kStatsWidth = 112;
const kStatsHeight = 56;

export type PerformanceStatsPosition = OverlayPosition;

export interface PerformanceStatsPlacement {
  position: PerformanceStatsPosition;
  inset: number;
}

export interface MountedPerformanceStats {
  dispose(): void;
}

export async function mountPerformanceStats(
  recorder: StatsRecorder,
  layer: OverlayLayer,
  placement: PerformanceStatsPlacement
): Promise<MountedPerformanceStats> {
  const { documentThemeMode } = await import("@jolly-pixel/ui");
  const document = layer.element.ownerDocument;

  const stats = document.createElement("jolly-stats");
  stats.recorder = recorder;
  stats.style.width = "100%";
  stats.style.height = "100%";

  const frame = document.createElement("div");
  Object.assign(frame.style, {
    boxSizing: "border-box",
    width: `${kStatsWidth}px`,
    height: `${kStatsHeight}px`,
    overflow: "hidden",
    borderRadius: "var(--jolly-radius-md, 6px)",
    background: "var(--jolly-surface-raised, rgb(128 128 128 / 0.15))",
    boxShadow: "var(--jolly-shadow-floating, 0 4px 16px rgb(0 0 0 / 30%))"
  });
  frame.append(stats);

  const scope = document.createElement("jolly-scope");
  scope.style.display = "contents";
  const theme = documentThemeMode();
  if (theme !== null) {
    scope.setAttribute("theme", theme);
  }
  scope.append(frame);

  return layer.mount(scope, {
    ...placement,
    interactive: true
  });
}
