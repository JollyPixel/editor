// Import Third-party Dependencies
import type * as THREE from "three";

// Import Internal Dependencies
import type { MeshBuildStats } from "../mesh/index.ts";
import type {
  DebugChunkBounds,
  DebugChunkEntry
} from "./types.ts";

export interface VoxelDebugStats {
  chunks: number;
  culledChunks: number;
  meshes: number;
  voxels: number;
  hiddenVoxels: number;
  faces: number;
  culledFaces: number;
  mergedFaces: number;
  vertices: number;
  triangles: number;
  facesPerSolidVoxel: number;
  bytesPerVertex: number;
  buildTimeMs: number;
}

/**
 * The live set of built chunks and the counters aggregated from it. Holds no
 * scene-graph object of its own.
 */
export class DebugChunkRegistry {
  #entries = new Map<string, DebugChunkEntry>();

  * [Symbol.iterator](): IterableIterator<DebugChunkEntry> {
    yield* this.#entries.values();
  }

  get size(): number {
    return this.#entries.size;
  }

  register(
    key: string,
    meshes: readonly THREE.Mesh[],
    stats: MeshBuildStats,
    bounds: DebugChunkBounds | null
  ): DebugChunkEntry {
    const entry: DebugChunkEntry = {
      key,
      meshes,
      stats: stats.clone(),
      bounds: bounds === null ? null : {
        origin: {
          x: bounds.origin.x,
          y: bounds.origin.y,
          z: bounds.origin.z
        },
        size: bounds.size
      },
      culled: false
    };
    this.#entries.set(key, entry);

    return entry;
  }

  cull(
    key: string,
    culled: boolean
  ): DebugChunkEntry | null {
    const entry = this.#entries.get(key);
    if (!entry || entry.culled === culled) {
      return null;
    }

    entry.culled = culled;

    return entry;
  }

  unregister(
    key: string
  ): boolean {
    return this.#entries.delete(key);
  }

  clear(): void {
    this.#entries.clear();
  }

  get stats(): VoxelDebugStats {
    const total: VoxelDebugStats = {
      chunks: 0,
      culledChunks: 0,
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
    for (const { meshes, stats, culled } of this.#entries.values()) {
      total.chunks++;
      if (culled) {
        total.culledChunks++;
      }
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
}
