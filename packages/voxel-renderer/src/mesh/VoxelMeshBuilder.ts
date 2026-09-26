// Import Third-party Dependencies
import type * as THREE from "three";

// Import Internal Dependencies
import type { IterableLayerChunk } from "../world/VoxelWorld.ts";
import type { BlockRegistry } from "../blocks/BlockRegistry.ts";
import type { BlockShapeRegistry } from "../blocks/shape/BlockShapeRegistry.ts";
import type { TilesetManager } from "../tileset/TilesetManager.ts";
import type {
  FaceBuffer,
  MeshableWorld,
  MeshPassOptions
} from "./types.ts";
import type { ChunkGeometryKey } from "./ChunkGeometryKey.ts";
import { BlockVariantCache } from "./variants/BlockVariantCache.ts";
import { GeometryBuffer } from "./GeometryBuffer.ts";
import { FaceTemplateTable } from "./pulling/FaceTemplateTable.ts";
import { PulledFaceBuffer } from "./pulling/PulledFaceBuffer.ts";
import { PulledChunkGeometry } from "./pulling/PulledChunkGeometry.ts";
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
  world: MeshableWorld;
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
  vertexPulling?: boolean;
  faceTemplates?: FaceTemplateTable;
  logger?: VoxelLogger;
}

/**
 * Builds visible chunk geometry, split by tileset and cutout mode. Vertex
 * positions are relative to the chunk origin in world space.
 */
export class VoxelMeshBuilder {
  readonly stats = new MeshBuildStats();

  ambientOcclusion: boolean;

  readonly faceTemplates: FaceTemplateTable;

  #world: MeshableWorld;
  #variants: BlockVariantCache;
  #greedyMesher: GreedyMesher;
  #naiveMesher: NaiveMesher;
  #greedy: boolean;
  #vertexPulling: boolean;
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
  #pulledBuffers: (PulledFaceBuffer | undefined)[] = [];
  #pulledBufferFor = (slot: number): PulledFaceBuffer => {
    let buffer = this.#pulledBuffers[slot];
    if (buffer === undefined) {
      buffer = new PulledFaceBuffer(this.faceTemplates);
      buffer.reset(...this.#origin);
      this.#pulledBuffers[slot] = buffer;
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
    this.#vertexPulling = options.vertexPulling ?? false;
    this.faceTemplates = options.faceTemplates ?? new FaceTemplateTable();
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

  get vertexPulling(): boolean {
    return this.#vertexPulling;
  }

  set vertexPulling(
    value: boolean
  ) {
    this.#vertexPulling = value;
  }

  get pullsVertices(): boolean {
    return this.#vertexPulling && !this.#greedy;
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

    for (const member of drawn) {
      neighbourhood.self = member.layer;
      const pass: MeshPassOptions<GeometryBuffer> = {
        chunk: member.chunk,
        neighbourhood,
        worldOriginX,
        worldOriginY,
        worldOriginZ,
        stats,
        bufferFor: this.#bufferFor,
        ambientOcclusion: this.ambientOcclusion
      };
      if (this.#greedy) {
        this.#greedyMesher.mesh(pass);
      }
      else if (this.#vertexPulling) {
        this.#naiveMesher.mesh({ ...pass, bufferFor: this.#pulledBufferFor });
      }
      else {
        this.#naiveMesher.mesh(pass);
      }
    }

    const geometries = this.#collectGeometries();
    stats.buildTimeMs = performance.now() - startedAt;

    return geometries;
  }

  #activeBuffers(): readonly (FaceBuffer | undefined)[] {
    return this.pullsVertices ? this.#pulledBuffers : this.#buffers;
  }

  #resetBuffers(): void {
    for (const buffer of this.#activeBuffers()) {
      buffer?.reset(...this.#origin);
    }
  }

  #collectGeometries(): Map<ChunkGeometryKey, THREE.BufferGeometry> {
    const result = new Map<ChunkGeometryKey, THREE.BufferGeometry>();
    const { stats } = this;
    const buffers = this.#activeBuffers();

    for (let slot = 0; slot < buffers.length; slot++) {
      const buffer = buffers[slot];
      if (buffer === undefined || buffer.vertexCount === 0) {
        continue;
      }

      const geometry = buffer.toGeometry(this.#quadIndex);
      stats.vertices += buffer.vertexCount;
      stats.triangles += buffer.triangleCount;
      stats.geometries++;
      stats.bytesPerVertex = buffer.bytesPerVertex;
      stats.bytes += byteLengthOf(geometry);
      result.set(this.#variants.geometryKeyAt(slot), geometry);
    }

    return result;
  }
}

function byteLengthOf(
  geometry: THREE.BufferGeometry
): number {
  let bytes = geometry.index?.array.byteLength ?? 0;
  for (const attribute of Object.values(geometry.attributes)) {
    bytes += attribute.array.byteLength;
  }
  if (geometry instanceof PulledChunkGeometry) {
    bytes += (geometry.faces.image.data as Uint32Array).byteLength;
  }

  return bytes;
}
