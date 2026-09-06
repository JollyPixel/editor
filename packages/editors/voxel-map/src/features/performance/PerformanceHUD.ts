// Import Third-party Dependencies
import {
  Pane,
  formatCount,
  formatDecimal,
  formatMilliseconds,
  formatPercent
} from "@jolly-pixel/ui";
import type { Keyboard } from "@jolly-pixel/controls";
import type { VoxelDebugMode } from "@jolly-pixel/voxel.renderer";

// CONSTANTS
const kToggleKey = "F3";
const kStorageKey = "voxel-map:performance-hud";
const kDebugModeOptions: Record<VoxelDebugMode, VoxelDebugMode> = {
  off: "off",
  overlay: "overlay",
  wireframe: "wireframe"
};

export interface RendererPerformanceStats {
  calls: number;
  triangles: number;
  geometries: number;
  textures: number;
}

export interface VoxelPerformanceStats {
  mode: VoxelDebugMode;
  chunks: number;
  meshes: number;
  voxels: number;
  faces: number;
  culled: number;
  merged: number;
  triangles: number;
  facesPerVoxel: number;
  buildMs: number;
}

export interface PerformanceSnapshot {
  renderer: RendererPerformanceStats;
  voxel: VoxelPerformanceStats;
}

export interface PerformanceHUDOptions {
  keyboard: Keyboard;
  onDebugModeChange: (mode: VoxelDebugMode) => void;
}

export class PerformanceHUD {
  #pane: Pane;
  #keyboard: Keyboard;
  #worldFolder: ReturnType<Pane["addFolder"]>;
  #meshFolder: ReturnType<Pane["addFolder"]>;
  #onDebugModeChange: (mode: VoxelDebugMode) => void;

  #rendererStats: RendererPerformanceStats = {
    calls: 0,
    triangles: 0,
    geometries: 0,
    textures: 0
  };
  #voxelStats: VoxelPerformanceStats = {
    mode: "off",
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

  #onToggleKey = (
    event: KeyboardEvent
  ): void => {
    // Auto-repeat would flicker the pane while the key stays held.
    if (event.repeat) {
      return;
    }

    this.#pane.hidden = !this.#pane.hidden;
  };

  constructor(
    options: PerformanceHUDOptions
  ) {
    this.#keyboard = options.keyboard;
    this.#onDebugModeChange = options.onDebugModeChange;

    const pane = new Pane({
      title: "Voxel Stats [F3]",
      storageKey: kStorageKey,
      collapsible: true
    });
    this.#pane = pane;

    const worldFolder = pane.addFolder({ title: "World" });
    worldFolder.addBinding(this.#voxelStats, "mode", {
      options: kDebugModeOptions,
      label: "debug"
    }).on("change", ({ value }) => {
      this.#onDebugModeChange(value);
    });
    worldFolder.addMonitors(this.#voxelStats, {
      chunks: { label: "chunks", format: formatCount },
      voxels: { label: "voxels", format: formatCount }
    });
    this.#worldFolder = worldFolder;

    const meshFolder = pane.addFolder({ title: "Mesh" });
    meshFolder.addMonitors(this.#voxelStats, {
      meshes: { label: "meshes", format: formatCount },
      faces: { label: "faces", format: formatCount },
      culled: { label: "culled", format: formatPercent },
      merged: { label: "merged", format: formatPercent },
      triangles: { label: "mesh tris", format: formatCount },
      facesPerVoxel: { label: "faces/voxel", format: formatDecimal },
      buildMs: { label: "build time", format: formatMilliseconds }
    });
    meshFolder.addMonitors(this.#rendererStats, {
      calls: { label: "draw calls", format: formatCount },
      triangles: { label: "rendered tris", format: formatCount },
      geometries: { label: "geometries", format: formatCount },
      textures: { label: "textures", format: formatCount }
    });
    this.#meshFolder = meshFolder;

    this.#keyboard.on(kToggleKey, this.#onToggleKey);
  }

  update(
    snapshot: PerformanceSnapshot
  ): void {
    Object.assign(this.#rendererStats, snapshot.renderer);
    Object.assign(this.#voxelStats, snapshot.voxel);
    this.#worldFolder.refresh();
    this.#meshFolder.refresh();
  }

  dispose(): void {
    this.#keyboard.off(kToggleKey, this.#onToggleKey);
    this.#pane.dispose();
  }
}
