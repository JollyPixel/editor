// Import Third-party Dependencies
import { ActorComponent, type Actor } from "@jolly-pixel/engine";
import {
  type VoxelDebugMode,
  type VoxelRenderer
} from "@jolly-pixel/voxel.renderer";
import { Pane, type FolderApi } from "tweakpane";
import type * as THREE from "three/webgpu";

// CONSTANTS
const kRefreshInterval = 0.2;
const kBytesPerMebibyte = 1024 * 1024;
const kGraphMaxFps = 165;
const kGraphRows = 3;
const kToggleKey = "F3";
const kHudStyle = [
  "position:absolute",
  "top:8px",
  "right:8px",
  "z-index:100"
].join(";");
const kDebugModeOptions: Record<VoxelDebugMode, VoxelDebugMode> = {
  off: "off",
  overlay: "overlay",
  wireframe: "wireframe"
};

export interface PerformanceHUDOptions {
  vr: VoxelRenderer;
}

export class PerformanceHUD extends ActorComponent {
  #vr: VoxelRenderer;
  #renderer: THREE.WebGPURenderer | null = null;

  #container: HTMLDivElement | null = null;
  #pane: Pane | null = null;
  #rendererFolder: FolderApi | null = null;
  #voxelFolder: FolderApi | null = null;

  #rendererStats = {
    fps: 0,
    worstMs: 0,
    calls: 0,
    triangles: 0,
    geometries: 0,
    textures: 0,
    heapMiB: 0
  };
  // `mode` mirrors `VoxelDebugger.mode` so the dropdown stays correct if the
  // mode is changed from elsewhere; every other field is a read-only monitor.
  #voxelStats = {
    mode: "off" as VoxelDebugMode,
    chunks: 0,
    meshes: 0,
    voxels: 0,
    faces: 0,
    culled: 0,
    merged: 0,
    triangles: 0,
    facesPerVoxel: 0,
    buildMs: 0
  };

  #elapsed = 0;
  #frames = 0;
  #worstFrame = 0;
  // Stored so the listener can be removed in destroy()
  #onKeyDown: (event: KeyboardEvent) => void;

  constructor(
    actor: Actor,
    options: PerformanceHUDOptions
  ) {
    super({
      actor,
      typeName: "PerformanceHUD"
    });
    this.#vr = options.vr;

    this.#onKeyDown = (event: KeyboardEvent) => {
      if (event.key === kToggleKey) {
        event.preventDefault();
        if (this.#pane) {
          this.#pane.hidden = !this.#pane.hidden;
        }
      }
    };
  }

  awake() {
    this.#renderer = this.actor.world.renderer.getSource() as THREE.WebGPURenderer;

    const gameContainer = document.querySelector<HTMLElement>("#game-container")!;
    this.#container = document.createElement("div");
    this.#container.style.cssText = kHudStyle;
    gameContainer.appendChild(this.#container);

    const pane = new Pane({ container: this.#container, title: "Performance [F3]" });
    this.#pane = pane;

    const rendererFolder = pane.addFolder({ title: "Renderer" });
    // Graph and numeric readout share the same value.
    rendererFolder.addBinding(this.#rendererStats, "fps", {
      readonly: true,
      interval: 0,
      view: "graph",
      min: 0,
      max: kGraphMaxFps,
      rows: kGraphRows,
      label: "fps"
    });
    addMonitors(rendererFolder, this.#rendererStats, {
      fps: { label: "fps", format: formatCount },
      worstMs: { label: "worst", format: formatMilliseconds },
      calls: { label: "draw calls", format: formatCount },
      triangles: { label: "triangles", format: formatCount },
      geometries: { label: "geometries", format: formatCount },
      textures: { label: "textures", format: formatCount }
    });
    if (readHeapMebibytes() !== null) {
      addMonitors(rendererFolder, this.#rendererStats, {
        heapMiB: { label: "js heap (MiB)", format: formatCount }
      });
    }
    this.#rendererFolder = rendererFolder;

    const voxelFolder = pane.addFolder({ title: "Voxels" });
    voxelFolder
      .addBinding(this.#voxelStats, "mode", {
        options: kDebugModeOptions,
        label: "debug"
      })
      .on("change", ({ value }) => {
        this.#vr.engine.debug.mode = value;
      });
    addMonitors(voxelFolder, this.#voxelStats, {
      chunks: { label: "chunks", format: formatCount },
      meshes: { label: "meshes", format: formatCount },
      voxels: { label: "voxels", format: formatCount },
      faces: { label: "faces", format: formatCount },
      culled: { label: "culled", format: formatPercent },
      merged: { label: "merged", format: formatPercent },
      triangles: { label: "mesh tris", format: formatCount },
      facesPerVoxel: { label: "faces/voxel", format: formatDecimal },
      buildMs: { label: "build time", format: formatMilliseconds }
    });
    this.#voxelFolder = voxelFolder;

    document.addEventListener("keydown", this.#onKeyDown);
    this.#refresh(0, 0);
  }

  update(dt: number) {
    this.#frames++;
    this.#elapsed += dt;
    this.#worstFrame = Math.max(this.#worstFrame, dt);

    if (this.#elapsed < kRefreshInterval) {
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
    if (!this.#renderer || !this.#rendererFolder || !this.#voxelFolder) {
      return;
    }

    const { render, memory } = this.#renderer.info;
    this.#rendererStats.fps = fps;
    this.#rendererStats.worstMs = worstFrame * 1000;
    this.#rendererStats.calls = render.drawCalls;
    this.#rendererStats.triangles = render.triangles;
    this.#rendererStats.geometries = memory.geometries;
    this.#rendererStats.textures = memory.textures;
    this.#rendererStats.heapMiB = readHeapMebibytes() ?? 0;
    this.#rendererFolder.refresh();

    const {
      chunks, meshes, voxels, faces, culledFaces, mergedFaces,
      triangles, facesPerSolidVoxel, buildTimeMs
    } = this.#vr.engine.debug.stats;
    const candidates = faces + culledFaces;
    const emitted = faces + mergedFaces;

    this.#voxelStats.mode = this.#vr.engine.debug.mode;
    this.#voxelStats.chunks = chunks;
    this.#voxelStats.meshes = meshes;
    this.#voxelStats.voxels = voxels;
    this.#voxelStats.faces = faces;
    this.#voxelStats.culled = candidates === 0 ? 0 : (culledFaces / candidates) * 100;
    this.#voxelStats.merged = emitted === 0 ? 0 : (mergedFaces / emitted) * 100;
    this.#voxelStats.triangles = triangles;
    this.#voxelStats.facesPerVoxel = facesPerSolidVoxel;
    this.#voxelStats.buildMs = buildTimeMs;
    this.#voxelFolder.refresh();
  }

  override destroy() {
    document.removeEventListener("keydown", this.#onKeyDown);
    this.#pane?.dispose();
    this.#pane = null;
    this.#rendererFolder = null;
    this.#voxelFolder = null;
    this.#container?.remove();
    this.#container = null;

    super.destroy();
  }
}

type MonitorState = Record<string, number | string>;

interface MonitorField {
  label: string;
  /** Number monitors only; ignored for string values. */
  format?: (value: number) => string;
}

type MonitorFields<TState extends MonitorState> = {
  [K in keyof TState]?: MonitorField;
};

/**
 * Binds the named fields of `state` as read-only rows. Tweakpane's polling
 * ticker is left off (`interval: 0`): the caller decides when the values are
 * fresh and calls `folder.refresh()`.
 */
function addMonitors<TState extends MonitorState>(
  folder: FolderApi,
  state: TState,
  fields: MonitorFields<TState>
): void {
  for (const [key, field] of Object.entries(fields)) {
    if (!field) {
      continue;
    }

    folder.addBinding(state, key, {
      readonly: true,
      interval: 0,
      label: field.label,
      format: field.format
    });
  }
}

function formatCount(
  value: number
): string {
  return Math.round(value).toLocaleString("en-US");
}

function formatMilliseconds(
  value: number
): string {
  return `${value.toFixed(1)} ms`;
}

function formatPercent(
  value: number
): string {
  return `${value.toFixed(1)} %`;
}

function formatDecimal(
  value: number
): string {
  return value.toFixed(1);
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
