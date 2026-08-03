// Import Third-party Dependencies
import type * as THREE from "three";

// Import Internal Dependencies
import type { VoxelWorld } from "../world/VoxelWorld.ts";
import type { VoxelChunk } from "../world/VoxelChunk.ts";
import type { VoxelLayer } from "../world/VoxelLayer.ts";
import type { BlockRegistry } from "../blocks/BlockRegistry.ts";
import type { BlockShapeRegistry } from "../blocks/BlockShapeRegistry.ts";
import type { TilesetManager } from "../tileset/TilesetManager.ts";
import {
  voxelBlockId,
  voxelTransform
} from "../world/packedVoxel.ts";
import {
  FACE_OFFSETS,
  FACE_OPPOSITE
} from "./math.ts";
import { BlockVariantCache } from "./BlockVariantCache.ts";
import { GeometryBuffer } from "./GeometryBuffer.ts";
import { MeshBuildStats } from "./MeshBuildStats.ts";
import {
  GreedyMesher,
  type MeshPassOptions
} from "./GreedyMesher.ts";
import { ChunkNeighbourhood } from "./ChunkNeighbourhood.ts";

export interface VoxelMeshBuilderOptions {
  world: VoxelWorld;
  blockRegistry: BlockRegistry;
  shapeRegistry: BlockShapeRegistry;
  tilesetManager: TilesetManager;
  /**
   * Merge coplanar identical faces into the largest quads possible instead of
   * emitting one quad per voxel face. See `GreedyMesher`.
   *
   * Geometry built this way carries the extra `tileRegion` / `tileRepeat`
   * attributes and needs a material prepared by `enableTileWrapping()`.
   * @default false
   */
  greedy?: boolean;
}

/**
 * Builds per-tileset THREE.BufferGeometries for one chunk.
 *
 * Default algorithm (naive face culling): for each filled voxel, emit only the
 * faces where the adjacent voxel in the face's direction either does not exist
 * or does not occlude. Non-axis-aligned faces (slopes, corners) correctly
 * rotate their culling direction before the neighbour lookup.
 *
 * With `greedy` enabled, `GreedyMesher` takes over and stretches each cube-like
 * face over the largest run of identical voxels it can, cutting the triangle
 * count by roughly 3× on terrain. Faces it cannot stretch still go through the
 * naive path, so mixed chunks keep working.
 *
 * Voxels hidden by a higher-priority layer are skipped. Geometry is split by
 * tileset so each mesh can use the correct texture.
 */
export class VoxelMeshBuilder {
  /**
   * Counters for the most recent `buildChunkGeometries()` call. The instance is
   * reused, so callers keeping the numbers around must `clone()` them.
   */
  readonly stats = new MeshBuildStats();

  #world: VoxelWorld;
  #tilesetManager: TilesetManager;
  #variants: BlockVariantCache;
  #greedyMesher: GreedyMesher;
  #greedy: boolean;

  /** One reusable accumulator per tileset slot, kept across chunk builds. */
  #buffers: (GeometryBuffer | undefined)[] = [];

  /**
   * Bound once so the greedy pass allocates no closure per chunk.
   */
  #bufferFor = (slot: number): GeometryBuffer => {
    let buffer = this.#buffers[slot];
    if (buffer === undefined) {
      buffer = new GeometryBuffer({ tiled: this.#greedy });
      this.#buffers[slot] = buffer;
    }

    return buffer;
  };

  constructor(
    options: VoxelMeshBuilderOptions
  ) {
    this.#world = options.world;
    this.#tilesetManager = options.tilesetManager;
    this.#greedy = options.greedy ?? false;
    this.#variants = new BlockVariantCache({
      blockRegistry: options.blockRegistry,
      shapeRegistry: options.shapeRegistry,
      tilesetManager: options.tilesetManager
    });
    this.#greedyMesher = new GreedyMesher(this.#variants);
  }

  get greedy(): boolean {
    return this.#greedy;
  }

  /**
   * Switching modes changes the attribute layout, so the accumulators are
   * dropped rather than reused. Callers must rebuild every chunk afterwards.
   */
  set greedy(value: boolean) {
    if (value === this.#greedy) {
      return;
    }

    this.#greedy = value;
    this.#buffers = [];
  }

  /**
   * Builds merged BufferGeometries for one chunk, grouped by tileset ID.
   * Returns null if the chunk is empty or produces no visible faces.
   *
   * Each entry in the returned Map is a separate geometry containing only the
   * faces whose tile references belong to that tileset, allowing the caller to
   * bind the correct texture per draw call.
   */
  buildChunkGeometries(
    chunk: VoxelChunk,
    layer: VoxelLayer
  ): Map<string, THREE.BufferGeometry> | null {
    const { stats } = this;
    stats.reset();

    // No tileset registered yet — cannot compute UVs. Return null so the
    // caller skips mesh creation; loadTileset() will mark chunks dirty and
    // trigger a rebuild once the texture is available.
    if (this.#tilesetManager.defaultTilesetId === null || chunk.voxelCount === 0) {
      return null;
    }
    const startedAt = performance.now();
    this.#variants.refresh();

    const chunkSize = this.#world.chunkSize;
    const worldOriginX = (chunk.cx * chunkSize) + layer.offset.x;
    const worldOriginY = (chunk.cy * chunkSize) + layer.offset.y;
    const worldOriginZ = (chunk.cz * chunkSize) + layer.offset.z;

    // Culling reads one voxel outside the chunk on every axis.
    const neighbourhood = new ChunkNeighbourhood({
      world: this.#world,
      variants: this.#variants,
      layer,
      minWx: worldOriginX - 1,
      minWy: worldOriginY - 1,
      minWz: worldOriginZ - 1
    });

    this.#resetBuffers();

    const pass: MeshPassOptions = {
      chunk,
      neighbourhood,
      worldOriginX,
      worldOriginY,
      worldOriginZ,
      alpha: Math.round(layer.opacity * 255),
      stats,
      bufferFor: this.#bufferFor
    };
    const emitted = this.#greedy ?
      this.#greedyMesher.mesh(pass) :
      this.#buildNaive(pass);

    const geometries = emitted ? this.#collectGeometries() : null;
    stats.buildTimeMs = performance.now() - startedAt;

    return geometries;
  }

  /**
   * One quad per visible voxel face. Takes the same options as the greedy pass
   * so `buildChunkGeometries()` can hand either one the same object.
   */
  #buildNaive(
    options: MeshPassOptions
  ): boolean {
    const {
      chunk,
      neighbourhood,
      worldOriginX,
      worldOriginY,
      worldOriginZ,
      alpha,
      stats
    } = options;
    const size = chunk.size;
    // Decoding the linear index costs two divisions and two modulos per voxel;
    // a power-of-two chunk size turns both into shifts and masks.
    const shift = (size & (size - 1)) === 0 ? Math.log2(size) : -1;
    const mask = size - 1;
    const { keys, values, capacity } = chunk.store;
    let emitted = false;

    for (let slot = 0; slot < capacity; slot++) {
      const linearIdx = keys[slot];
      if (linearIdx < 0) {
        continue;
      }

      let lx: number;
      let ly: number;
      let lz: number;
      if (shift >= 0) {
        lx = linearIdx & mask;
        ly = (linearIdx >> shift) & mask;
        lz = linearIdx >> (shift * 2);
      }
      else {
        lx = linearIdx % size;
        ly = ((linearIdx / size) | 0) % size;
        lz = (linearIdx / (size * size)) | 0;
      }

      const wx = worldOriginX + lx;
      const wy = worldOriginY + ly;
      const wz = worldOriginZ + lz;

      stats.voxels++;
      if (!neighbourhood.winsCompositing(wx, wy, wz)) {
        stats.hiddenVoxels++;
        continue;
      }

      const packed = values[slot];
      const variant = this.#variants.get(
        voxelBlockId(packed),
        voxelTransform(packed)
      );
      if (variant === null) {
        continue;
      }

      for (const face of variant.faces) {
        const { cull } = face;
        if (cull >= 0) {
          const offset = FACE_OFFSETS[cull];
          const hidden = neighbourhood.isNeighbourFaceHidden(
            wx + offset[0],
            wy + offset[1],
            wz + offset[2],
            FACE_OPPOSITE[cull]
          );
          if (hidden) {
            stats.culledFaces++;
            continue;
          }
        }

        this.#bufferFor(face.slot).addFace(face, wx, wy, wz, alpha);
        stats.faces++;
        emitted = true;
      }
    }

    return emitted;
  }

  #resetBuffers(): void {
    for (const buffer of this.#buffers) {
      buffer?.reset();
    }
  }

  #collectGeometries(): Map<string, THREE.BufferGeometry> | null {
    const result = new Map<string, THREE.BufferGeometry>();
    const { stats } = this;

    for (let slot = 0; slot < this.#buffers.length; slot++) {
      const buffer = this.#buffers[slot];
      if (buffer === undefined || buffer.vertexCount === 0) {
        continue;
      }

      stats.vertices += buffer.vertexCount;
      stats.triangles += buffer.indexCount / 3;
      stats.geometries++;
      result.set(this.#variants.tilesetIdAt(slot), buffer.toGeometry());
    }

    return result.size > 0 ? result : null;
  }
}
