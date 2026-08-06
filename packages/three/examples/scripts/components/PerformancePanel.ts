// Import Third-party Dependencies
import type * as THREE from "three/webgpu";
import type { FolderApi, Pane } from "tweakpane";

// Import Internal Dependencies
import {
  addMonitors,
  formatCount,
  formatMilliseconds
} from "../utils/pane.ts";

// CONSTANTS
const kBytesPerMebibyte = 1024 * 1024;
const kGraphMaxFps = 165;
const kGraphRows = 3;

export interface PerformancePanelOptions {
  /** Pane the folder is attached to. */
  pane: Pane;
  renderer: THREE.WebGPURenderer;
  /**
   * @default "Performance"
   */
  title?: string;
  /**
   * Seconds between two refreshes. Metrics are averaged over that window.
   * @default 0.25
   */
  refreshInterval?: number;
}

export class PerformancePanel {
  #renderer: THREE.WebGPURenderer;
  #refreshInterval: number;

  #folder: FolderApi;

  #stats = {
    fps: 0,
    worstMs: 0,
    calls: 0,
    triangles: 0,
    geometries: 0,
    textures: 0,
    heapMiB: 0
  };

  #elapsed = 0;
  #frames = 0;
  #worstFrame = 0;
  #lastTimestamp: number | null = null;

  constructor(
    options: PerformancePanelOptions
  ) {
    const {
      pane,
      renderer,
      title = "Performance",
      refreshInterval = 0.25
    } = options;

    this.#renderer = renderer;
    this.#refreshInterval = refreshInterval;

    const folder = pane.addFolder({ title, expanded: false });
    // Graph and numeric readout share the same value.
    folder.addBinding(this.#stats, "fps", {
      readonly: true,
      interval: 0,
      view: "graph",
      min: 0,
      max: kGraphMaxFps,
      rows: kGraphRows,
      label: "fps"
    });

    addMonitors(folder, this.#stats, {
      fps: { label: "fps", format: formatCount },
      worstMs: { label: "worst", format: formatMilliseconds },
      calls: { label: "draw calls", format: formatCount },
      triangles: { label: "triangles", format: formatCount },
      geometries: { label: "geometries", format: formatCount },
      textures: { label: "textures", format: formatCount }
    });

    if (readHeapMebibytes() !== null) {
      addMonitors(folder, this.#stats, {
        heapMiB: { label: "js heap (MiB)", format: formatCount }
      });
    }

    this.#folder = folder;
    this.#refresh(0, 0);
  }

  /**
    * Call once per animation frame before `renderer.render()`.
   */
  update(): void {
    const now = performance.now();
    if (this.#lastTimestamp === null) {
      this.#lastTimestamp = now;

      return;
    }

    const deltaTime = (now - this.#lastTimestamp) / 1000;
    this.#lastTimestamp = now;

    this.#frames++;
    this.#elapsed += deltaTime;
    this.#worstFrame = Math.max(this.#worstFrame, deltaTime);

    if (this.#elapsed < this.#refreshInterval) {
      return;
    }

    this.#refresh(this.#frames / this.#elapsed, this.#worstFrame);
    this.#elapsed = 0;
    this.#frames = 0;
    this.#worstFrame = 0;
  }

  #refresh(
    fps: number,
    worstFrame: number
  ): void {
    const { render, memory } = this.#renderer.info;

    this.#stats.fps = fps;
    this.#stats.worstMs = worstFrame * 1000;
    this.#stats.calls = render.drawCalls;
    this.#stats.triangles = render.triangles;
    this.#stats.geometries = memory.geometries;
    this.#stats.textures = memory.textures;
    this.#stats.heapMiB = readHeapMebibytes() ?? 0;

    this.#folder.refresh();
  }

  dispose(): void {
    this.#folder.dispose();
  }
}

/**
 * Probes Chromium's non-standard `performance.memory` support.
 */
function readHeapMebibytes(): number | null {
  const memory: unknown = "memory" in performance ? performance.memory : null;

  if (
    typeof memory === "object" &&
    memory !== null &&
    "usedJSHeapSize" in memory &&
    typeof memory.usedJSHeapSize === "number"
  ) {
    return memory.usedJSHeapSize / kBytesPerMebibyte;
  }

  return null;
}
