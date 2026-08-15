// Import Third-party Dependencies
import type { StatsRecorder } from "@jolly-pixel/ui/stats";

// Import Internal Dependencies
import {
  resolveStatsOverlayX,
  type PerformanceStatsPosition
} from "./resolveStatsOverlayX.ts";

// CONSTANTS
const kStatsInset = 8;
const kStatsWidth = 112;
const kStatsHeight = 56;

export interface MountedPerformanceStats {
  dispose(): void;
}

/** Mounts the default performance HUD and owns its DOM lifecycle. */
export async function mountPerformanceStats(
  recorder: StatsRecorder,
  position: PerformanceStatsPosition
): Promise<MountedPerformanceStats> {
  await import("@jolly-pixel/ui");

  const floating = document.createElement("jolly-floating");
  const view = document.defaultView;
  function positionOverlay(): void {
    floating.x = resolveStatsOverlayX(
      position,
      view?.innerWidth ?? document.documentElement.clientWidth,
      floating.width,
      kStatsInset
    );
    floating.y = kStatsInset;
  }

  floating.width = kStatsWidth;
  floating.height = kStatsHeight;
  positionOverlay();
  if (position === "top-right" && view !== null) {
    view.addEventListener("resize", positionOverlay);
  }

  const stats = document.createElement("jolly-stats");
  stats.recorder = recorder;
  stats.style.width = "100%";
  stats.style.height = "100%";
  floating.append(stats);
  document.body.append(floating);

  return {
    dispose() {
      if (position === "top-right" && view !== null) {
        view.removeEventListener("resize", positionOverlay);
      }
      floating.remove();
    }
  };
}
