// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import type { MeshBuildStats } from "../mesh/MeshBuildStats.ts";

// CONSTANTS
const kDefaultColor = 0x66FF99;
const kDefaultOpacity = 0.5;
const kModeCycle: Record<VoxelDebugMode, VoxelDebugMode> = {
  off: "overlay",
  overlay: "wireframe",
  wireframe: "off"
};

/**
 * - `off`: chunks render normally, only counters are collected.
 * - `overlay`: a wireframe copy is drawn on top of the textured chunks.
 * - `wireframe`: the textured chunks are hidden, leaving only the wireframe.
 */
export type VoxelDebugMode =
  | "off"
  | "overlay"
  | "wireframe";

export interface VoxelDebuggerOptions {
  /**
   * @default "off"
   */
  mode?: VoxelDebugMode;
  /**
   * Wireframe color.
   * @default 0x66FF99
   */
  color?: THREE.ColorRepresentation;
  /**
   * Wireframe opacity, `1` disables blending.
   * @default 0.5
   */
  opacity?: number;
}

/**
 * Aggregated counters for every chunk currently meshed by the engine.
 */
export interface VoxelDebugStats {
  /** Chunks the mesh builder processed, including those emitting no face. */
  chunks: number;
  /** Chunk meshes attached to the scene graph, i.e. one draw call each. */
  meshes: number;
  voxels: number;
  hiddenVoxels: number;
  faces: number;
  culledFaces: number;
  vertices: number;
  triangles: number;
  /** Sum of the last build time of every live chunk, not a frame cost. */
  buildTimeMs: number;
}

interface DebugChunk {
  meshes: readonly THREE.Mesh[];
  stats: MeshBuildStats;
  overlays: THREE.Mesh[];
}

/**
 * Runtime inspector for `VoxelEngine`: keeps the per-chunk mesh counters the
 * builder produces and, on demand, draws the chunk geometry as a wireframe.
 */
export class VoxelDebugger {
  #parent: THREE.Object3D;
  #group = new THREE.Group();
  #chunks = new Map<string, DebugChunk>();
  #material: THREE.MeshBasicMaterial | null = null;

  #mode: VoxelDebugMode;
  #color: THREE.ColorRepresentation;
  #opacity: number;

  constructor(
    parent: THREE.Object3D,
    options: VoxelDebuggerOptions = {}
  ) {
    const {
      mode = "off",
      color = kDefaultColor,
      opacity = kDefaultOpacity
    } = options;

    this.#mode = mode;
    this.#color = color;
    this.#opacity = opacity;

    this.#parent = parent;
    this.#group.name = "VoxelDebugger";
    // Attached only while a wireframe is drawn, so a disabled debugger leaves
    // no trace in the scene graph.
    if (this.enabled) {
      parent.add(this.#group);
    }
  }

  get mode(): VoxelDebugMode {
    return this.#mode;
  }

  /**
   * Applies the new mode to every chunk already built.
   */
  set mode(value: VoxelDebugMode) {
    if (value === this.#mode) {
      return;
    }

    this.#mode = value;
    for (const chunk of this.#chunks.values()) {
      this.#applyMode(chunk);
    }

    if (this.enabled) {
      this.#parent.add(this.#group);
    }
    else {
      this.#group.removeFromParent();
    }
  }

  get enabled(): boolean {
    return this.#mode !== "off";
  }

  set enabled(value: boolean) {
    this.mode = value ? "overlay" : "off";
  }

  /**
   * Cycles `off` → `overlay` → `wireframe` → `off`, for a debug keybinding.
   */
  nextMode(): VoxelDebugMode {
    this.mode = kModeCycle[this.#mode];

    return this.#mode;
  }

  get stats(): VoxelDebugStats {
    const total: VoxelDebugStats = {
      chunks: 0,
      meshes: 0,
      voxels: 0,
      hiddenVoxels: 0,
      faces: 0,
      culledFaces: 0,
      vertices: 0,
      triangles: 0,
      buildTimeMs: 0
    };

    for (const { meshes, stats } of this.#chunks.values()) {
      total.chunks++;
      total.meshes += meshes.length;
      total.voxels += stats.voxels;
      total.hiddenVoxels += stats.hiddenVoxels;
      total.faces += stats.faces;
      total.culledFaces += stats.culledFaces;
      total.vertices += stats.vertices;
      total.triangles += stats.triangles;
      total.buildTimeMs += stats.buildTimeMs;
    }

    return total;
  }

  /**
   * Records the result of one chunk build. `stats` is copied because the
   * builder reuses its instance for the next chunk.
   */
  registerChunk(
    key: string,
    meshes: readonly THREE.Mesh[],
    stats: MeshBuildStats
  ): void {
    this.unregisterChunk(key);

    const chunk: DebugChunk = {
      meshes,
      stats: stats.clone(),
      overlays: []
    };
    this.#chunks.set(key, chunk);
    this.#applyMode(chunk);
  }

  unregisterChunk(
    key: string
  ): void {
    const chunk = this.#chunks.get(key);
    if (!chunk) {
      return;
    }

    this.#clearOverlays(chunk);
    this.#chunks.delete(key);
  }

  clear(): void {
    for (const chunk of this.#chunks.values()) {
      this.#clearOverlays(chunk);
    }
    this.#chunks.clear();
  }

  dispose(): void {
    this.clear();
    this.#group.removeFromParent();
    this.#material?.dispose();
    this.#material = null;
  }

  #applyMode(
    chunk: DebugChunk
  ): void {
    const visible = this.#mode !== "wireframe";
    for (const mesh of chunk.meshes) {
      mesh.visible = visible;
    }

    if (this.#mode === "off") {
      this.#clearOverlays(chunk);

      return;
    }
    if (chunk.overlays.length > 0) {
      return;
    }

    const material = this.#getMaterial();
    for (const mesh of chunk.meshes) {
      // Sharing the chunk geometry keeps the wireframe free of extra memory;
      // it is therefore never disposed here, the engine owns it.
      const overlay = new THREE.Mesh(mesh.geometry, material);
      overlay.name = `${mesh.name}:wireframe`;
      chunk.overlays.push(overlay);
      this.#group.add(overlay);
    }
  }

  #clearOverlays(
    chunk: DebugChunk
  ): void {
    for (const overlay of chunk.overlays) {
      this.#group.remove(overlay);
    }
    chunk.overlays.length = 0;
  }

  #getMaterial(): THREE.MeshBasicMaterial {
    this.#material ??= new THREE.MeshBasicMaterial({
      color: this.#color,
      wireframe: true,
      transparent: this.#opacity < 1,
      opacity: this.#opacity,
      // Wireframe lines are coplanar with the faces they trace and the default
      // depth function accepts equal values, so no polygon offset is needed.
      depthWrite: false,
      fog: false
    });

    return this.#material;
  }
}
