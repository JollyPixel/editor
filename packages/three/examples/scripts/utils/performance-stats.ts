// Import Third-party Dependencies
import "@jolly-pixel/ui";
import { StatsRecorder } from "@jolly-pixel/ui/stats";
import type * as THREE from "three/webgpu";

export interface PerformanceStats {
  begin(): void;
  end(): void;
  dispose(): void;
}

/** Mounts the shared compact performance HUD used by every three example. */
export function mountPerformanceStats(
  renderer: THREE.WebGPURenderer
): PerformanceStats {
  const recorder = new StatsRecorder();
  registerRendererMetrics(recorder, renderer);

  const stats = document.createElement("jolly-stats");
  stats.recorder = recorder;
  stats.storageKey = "three-examples:stats";
  stats.style.width = "100%";
  stats.style.height = "100%";

  const floating = document.createElement("jolly-floating");
  floating.x = 8;
  floating.y = 8;
  floating.width = 112;
  floating.height = 56;
  floating.minWidth = 112;
  floating.minHeight = 56;
  floating.storageKey = "three-examples:stats";
  floating.append(stats);

  const scope = document.querySelector("jolly-scope");
  if (scope === null) {
    throw new Error("mountPerformanceStats: no jolly-scope in this page");
  }
  scope.append(floating);

  return {
    begin: () => recorder.begin(),
    end: () => recorder.end(),
    dispose: () => floating.remove()
  };
}

function registerRendererMetrics(
  recorder: StatsRecorder,
  renderer: THREE.WebGPURenderer
): void {
  recorder.addMetric({
    id: "calls",
    label: "CALLS",
    better: "lower",
    sample: () => renderer.info.render.drawCalls
  });
  recorder.addMetric({
    id: "triangles",
    label: "TRIS",
    better: "lower",
    sample: () => renderer.info.render.triangles
  });
  recorder.addMetric({
    id: "geometries",
    label: "GEOM",
    better: "lower",
    sample: () => renderer.info.memory.geometries
  });
  recorder.addMetric({
    id: "textures",
    label: "TEX",
    better: "lower",
    sample: () => renderer.info.memory.textures
  });
}
