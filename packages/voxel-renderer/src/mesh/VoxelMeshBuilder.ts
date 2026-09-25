// Import Third-party Dependencies
import type * as THREE from "three";

// Import Internal Dependencies
import type {
  IterableLayerChunk,
  VoxelWorld
} from "../world/VoxelWorld.ts";
import type { BlockRegistry } from "../blocks/BlockRegistry.ts";
import type { BlockShapeRegistry } from "../blocks/shape/BlockShapeRegistry.ts";
import type { TilesetManager } from "../tileset/TilesetManager.ts";
import type { MeshPassOptions } from "./types.ts";
import type { ChunkGeometryKey } from "./ChunkGeometryKey.ts";
import { BlockVariantCache } from "./variants/BlockVariantCache.ts";
import { GeometryBuffer } from "./GeometryBuffer.ts";
import { QuadIndex } from "./QuadIndex.ts";
import { MeshBuildStats } from "./MeshBuildStats.ts";
import { GreedyMesher } from "./meshers/GreedyMesher.ts";
import { NaiveMesher } from "./meshers/NaiveMesher.ts";
import { ChunkNeighbourhood } from "./neighbourhood/ChunkNeighbourhood.ts";
import type { VoxelLogger } from "../utils/logger.ts";

// CONSTANTS
const kMaxWindowChunkSize = 64;

export interface VoxelMeshBuilderOptions {
  alphaTest?: number;
  world: VoxelWorld;
  blockRegistry: BlockRegistry;
  shapeRegistry: BlockShapeRegistry;
  tilesetManager: TilesetManager;
  /**
   * Enables greedy face merging and tiled geometry attributes.
   * @default false
   */
  greedy?: boolean;
  /**
   * Bakes per-vertex ambient occlusion into the normal attribute's `w`.
   * @default false
   */
  ambientOcclusion?: boolean;
  logger?: VoxelLogger;
}

/**
 * Builds visible chunk geometry, split by tileset and cutout mode. Vertex
 * positions are relative to the chunk origin in world space.
 */
export class VoxelMeshBuilder {
  readonly stats = new MeshBuildStats();

  ambientOcclusion: boolean;

  #world: VoxelWorld;
  #variants: BlockVariantCache;
  #greedyMesher: GreedyMesher;
  #naiveMesher: NaiveMesher;
  #greedy: boolean;
  #quadIndex = new QuadIndex();
  #origin: [number, number, number] = [0, 0, 0];
  #buffers: (GeometryBuffer | undefined)[] = [];
  #bufferFor = (slot: number): GeometryBuffer => {
    let buffer = this.#buffers[slot];
    if (buffer === undefined) {
      buffer = new GeometryBuffer({ tiled: this.#greedy });
      buffer.reset(...this.#origin);
      this.#buffers[slot] = buffer;
    }

    return buffer;
  };
  #windows: Int32Array[] = [];
  #windowFor = (index: number): Int32Array | null => {
    const span = this.#world.chunkSize + 2;
    if (span - 2 > kMaxWindowChunkSize) {
      return null;
    }

    let window = this.#windows[index];
    if (window === undefined || window.length !== span * span * span) {
      window = new Int32Array(span * span * span);
      this.#windows[index] = window;
    }

    return window;
  };

  constructor(
    options: VoxelMeshBuilderOptions
  ) {
    this.#world = options.world;
    this.#greedy = options.greedy ?? false;
    this.ambientOcclusion = options.ambientOcclusion ?? false;
    this.#variants = new BlockVariantCache({
      blockRegistry: options.blockRegistry,
      shapeRegistry: options.shapeRegistry,
      tilesetManager: options.tilesetManager,
      alphaTest: options.alphaTest,
      logger: options.logger
    });
    this.#greedyMesher = new GreedyMesher(this.#variants);
    this.#naiveMesher = new NaiveMesher(this.#variants);
  }

  get greedy(): boolean {
    return this.#greedy;
  }

  set greedy(
    value: boolean
  ) {
    if (value === this.#greedy) {
      return;
    }

    this.#greedy = value;
    this.#buffers = [];
  }

  buildChunkGeometries(
    members: readonly IterableLayerChunk[]
  ): Map<ChunkGeometryKey, THREE.BufferGeometry> {
    const { stats } = this;
    stats.reset();

    const drawn = members.filter(({ chunk }) => chunk.voxelCount > 0);
    if (drawn.length === 0) {
      return new Map();
    }
    const startedAt = performance.now();
    this.#variants.refresh();

    const chunkSize = this.#world.chunkSize;
    const [{ layer, chunk }] = drawn;
    const worldOriginX = (chunk.cx * chunkSize) + layer.position.x;
    const worldOriginY = (chunk.cy * chunkSize) + layer.position.y;
    const worldOriginZ = (chunk.cz * chunkSize) + layer.position.z;

    const neighbourhood = new ChunkNeighbourhood({
      world: this.#world,
      variants: this.#variants,
      minWx: worldOriginX - 1,
      minWy: worldOriginY - 1,
      minWz: worldOriginZ - 1,
      windowFor: this.#windowFor
    });

    this.#origin = [worldOriginX, worldOriginY, worldOriginZ];
    this.#resetBuffers();

    const mesher = this.#greedy ? this.#greedyMesher : this.#naiveMesher;
    for (const member of drawn) {
      neighbourhood.self = member.layer;
      const pass: MeshPassOptions = {
        chunk: member.chunk,
        neighbourhood,
        worldOriginX,
        worldOriginY,
        worldOriginZ,
        stats,
        bufferFor: this.#bufferFor,
        ambientOcclusion: this.ambientOcclusion
      };
      mesher.mesh(pass);
    }

    const geometries = this.#collectGeometries();
    stats.buildTimeMs = performance.now() - startedAt;

    return geometries;
  }

  #resetBuffers(): void {
    for (const buffer of this.#buffers) {
      buffer?.reset(...this.#origin);
    }
  }

  #collectGeometries(): Map<ChunkGeometryKey, THREE.BufferGeometry> {
    const result = new Map<ChunkGeometryKey, THREE.BufferGeometry>();
    const { stats } = this;

    for (let slot = 0; slot < this.#buffers.length; slot++) {
      const buffer = this.#buffers[slot];
      if (buffer === undefined || buffer.vertexCount === 0) {
        continue;
      }

      const geometry = buffer.toGeometry(this.#quadIndex);
      stats.vertices += buffer.vertexCount;
      stats.triangles += buffer.triangleCount;
      stats.geometries++;
      stats.bytesPerVertex = bytesPerVertex(geometry);
      result.set(this.#variants.geometryKeyAt(slot), geometry);
    }

    return result;
  }
}

function bytesPerVertex(
  geometry: THREE.BufferGeometry
): number {
  let total = 0;

  for (const attribute of Object.values(geometry.attributes)) {
    total += attribute.itemSize * attribute.array.BYTES_PER_ELEMENT;
  }

  return total;
}
