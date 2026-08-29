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
} from "../utils/math.ts";
import { BlockVariantCache } from "./BlockVariantCache.ts";
import { chunkGeometryKey } from "./chunkGeometryKey.ts";
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
   * Enables greedy face merging and tiled geometry attributes.
   * @default false
   */
  greedy?: boolean;
}

/**
 * Builds visible chunk geometry, split by tileset and cutout mode.
 */
export class VoxelMeshBuilder {
  /**
   * Reused counters for the latest build; clone them for retention.
   */
  readonly stats = new MeshBuildStats();

  #world: VoxelWorld;
  #tilesetManager: TilesetManager;
  #variants: BlockVariantCache;
  #greedyMesher: GreedyMesher;
  #greedy: boolean;

  #buffers: (GeometryBuffer | undefined)[] = [];

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
   * Drops buffers because switching modes changes their attribute layout.
   */
  set greedy(value: boolean) {
    if (value === this.#greedy) {
      return;
    }

    this.#greedy = value;
    this.#buffers = [];
  }

  /**
   * Builds visible chunk geometry grouped by tileset and cutout mode.
   */
  buildChunkGeometries(
    chunk: VoxelChunk,
    layer: VoxelLayer
  ): Map<string, THREE.BufferGeometry> | null {
    const { stats } = this;
    stats.reset();

    if (this.#tilesetManager.defaultTilesetId === null || chunk.voxelCount === 0) {
      return null;
    }
    const startedAt = performance.now();
    this.#variants.refresh();

    const chunkSize = this.#world.chunkSize;
    const worldOriginX = (chunk.cx * chunkSize) + layer.offset.x;
    const worldOriginY = (chunk.cy * chunkSize) + layer.offset.y;
    const worldOriginZ = (chunk.cz * chunkSize) + layer.offset.z;

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

  #buildNaive(
    options: MeshPassOptions
  ): boolean {
    const {
      chunk,
      neighbourhood,
      worldOriginX,
      worldOriginY,
      worldOriginZ,
      stats
    } = options;
    const { shift, mask } = chunk;
    const shiftZ = shift * 2;
    const { keys, values, capacity } = chunk.store;
    let emitted = false;

    for (let slot = 0; slot < capacity; slot++) {
      const linearIdx = keys[slot];
      if (linearIdx < 0) {
        continue;
      }

      const lx = linearIdx & mask;
      const ly = (linearIdx >> shift) & mask;
      const lz = linearIdx >> shiftZ;

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

        this.#bufferFor(face.slot).addFace(face, wx, wy, wz);
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

      const geometry = buffer.toGeometry();
      stats.vertices += buffer.vertexCount;
      stats.triangles += buffer.indexCount / 3;
      stats.geometries++;
      stats.bytesPerVertex = bytesPerVertex(geometry);
      result.set(
        chunkGeometryKey(
          this.#variants.tilesetIdAt(slot),
          this.#variants.isCutoutAt(slot)
        ),
        geometry
      );
    }

    return result.size > 0 ? result : null;
  }
}

/**
 * Returns vertex-attribute bytes per vertex, excluding indices.
 */
function bytesPerVertex(
  geometry: THREE.BufferGeometry
): number {
  let total = 0;

  for (const attribute of Object.values(geometry.attributes)) {
    total += attribute.itemSize * attribute.array.BYTES_PER_ELEMENT;
  }

  return total;
}
