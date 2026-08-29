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
 * Selects counters only, a wireframe overlay, or wireframe-only rendering.
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

export interface VoxelDebugStats {
  chunks: number;
  meshes: number;
  voxels: number;
  hiddenVoxels: number;
  faces: number;
  culledFaces: number;
  mergedFaces: number;
  vertices: number;
  triangles: number;
  /**
   * Faces emitted per voxel that contributed geometry.
   */
  facesPerSolidVoxel: number;
  /**
   * Vertex-weighted attribute bytes per vertex, excluding indices.
   */
  bytesPerVertex: number;
  buildTimeMs: number;
}

interface DebugChunk {
  meshes: readonly THREE.Mesh[];
  stats: MeshBuildStats;
  overlays: THREE.Mesh[];
}

/**
 * Tracks live chunk statistics and optional wireframe overlays.
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
      mergedFaces: 0,
      vertices: 0,
      triangles: 0,
      facesPerSolidVoxel: 0,
      bytesPerVertex: 0,
      buildTimeMs: 0
    };

    let vertexBytes = 0;
    for (const { meshes, stats } of this.#chunks.values()) {
      total.chunks++;
      total.meshes += meshes.length;
      total.voxels += stats.voxels;
      total.hiddenVoxels += stats.hiddenVoxels;
      total.faces += stats.faces;
      total.culledFaces += stats.culledFaces;
      total.mergedFaces += stats.mergedFaces;
      total.vertices += stats.vertices;
      total.triangles += stats.triangles;
      total.buildTimeMs += stats.buildTimeMs;
      vertexBytes += stats.bytesPerVertex * stats.vertices;
    }

    const solidVoxels = total.voxels - total.hiddenVoxels;
    if (solidVoxels > 0) {
      total.facesPerSolidVoxel = total.faces / solidVoxels;
    }
    if (total.vertices > 0) {
      total.bytesPerVertex = vertexBytes / total.vertices;
    }

    return total;
  }

  /**
   * Records a chunk build and copies its reused statistics object.
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
