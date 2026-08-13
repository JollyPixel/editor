// Import Third-party Dependencies
import { ActorComponent, type Actor } from "@jolly-pixel/engine";
import * as THREE from "three";
import {
  formatCount,
  formatMilliseconds,
  type Pane
} from "@jolly-pixel/ui";

// CONSTANTS
const kBytesPerMebibyte = 1024 * 1024;
const kGraphRows = 3;

export interface PerformancePanelOptions {
  /** Pane the folder is attached to, see `createExamplePane()`. */
  pane: Pane;
  /**
   * @default "Performance"
   */
  title?: string;
  /**
   * Seconds between two refreshes. Metrics are averaged over that window.
   * @default 0.25
   */
  refreshInterval?: number;
  /**
   * Called on every refresh, for folders the demo owns and wants updated on the
   * same cadence.
   */
  onRefresh?: () => void;
}

/**
 * Renderer statistics folder: framerate, draw calls, triangle count and heap
 * usage. Demos add their own folders to the same pane.
 */
export class PerformancePanel extends ActorComponent {
  #pane: Pane;
  #title: string;
  #refreshInterval: number;
  #onRefresh?: () => void;

  #folder: ReturnType<Pane["addFolder"]> | null = null;
  #renderer: THREE.WebGLRenderer | null = null;

  // Bound as-is by the folder; every field is refreshed at once.
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

  constructor(
    actor: Actor,
    options: PerformancePanelOptions
  ) {
    super({
      actor,
      typeName: "PerformancePanel"
    });

    const {
      pane,
      title = "Performance",
      refreshInterval = 0.25,
      onRefresh
    } = options;

    this.#pane = pane;
    this.#title = title;
    this.#refreshInterval = refreshInterval;
    this.#onRefresh = onRefresh;
  }

  awake(): void {
    this.#renderer = this.actor.world.renderer.getSource();

    // First: the pane holds only demo content (the switcher, theme and
    // density controls live in their own chrome pane), and the folder is
    // only created on awake, after the demo has attached its own.
    const folder = this.#pane.addFolder({ title: this.#title });
    this.#pane.element.prepend(folder.element);

    folder.addMonitor(this.#stats, "fps", {
      view: "graph",
      min: 0,
      rows: kGraphRows,
      label: "fps",
      format: formatCount
    });

    folder.addMonitors(this.#stats, {
      worstMs: { label: "worst", format: formatMilliseconds },
      calls: { label: "draw calls", format: formatCount },
      triangles: { label: "triangles", format: formatCount },
      geometries: { label: "geometries", format: formatCount },
      textures: { label: "textures", format: formatCount }
    });

    if (readHeapMebibytes() !== null) {
      folder.addMonitors(this.#stats, {
        heapMiB: { label: "js heap (MiB)", format: formatCount }
      });
    }

    this.#folder = folder;
    this.#refresh(0, 0);
  }

  update(
    deltaTime: number
  ): void {
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
    if (!this.#folder || !this.#renderer) {
      return;
    }

    const { render, memory } = this.#renderer.info;

    this.#stats.fps = fps;
    this.#stats.worstMs = worstFrame * 1000;
    this.#stats.calls = render.calls;
    this.#stats.triangles = render.triangles;
    this.#stats.geometries = memory.geometries;
    this.#stats.textures = memory.textures;
    this.#stats.heapMiB = readHeapMebibytes() ?? 0;

    this.#folder.refresh();
    this.#onRefresh?.();
  }

  override destroy(): void {
    this.#folder?.dispose();
    this.#folder = null;

    super.destroy();
  }
}

/**
 * `performance.memory` is a non-standard Chromium extension; probe it
 * structurally and report nothing on browsers that do not expose it.
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
