// Import Third-party Dependencies
import type * as THREE from "three";

// Import Internal Dependencies
import type { BlockRegistry } from "../blocks/BlockRegistry.ts";
import type { BlockShapeRegistry } from "../blocks/shape/BlockShapeRegistry.ts";
import type { TilesetResolver } from "./variants/types.ts";
import type {
  ChunkMeshData,
  FaceBuffer,
  MeshableLayerChunk,
  MeshableWorld,
  MeshPassOptions
} from "./types.ts";
import type { ChunkGeometryKey } from "./ChunkGeometryKey.ts";
import { BlockVariantCache } from "./variants/BlockVariantCache.ts";
import {
  GeometryBuffer,
  createQuadGeometry,
  quadMeshBytes
} from "./GeometryBuffer.ts";
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
  tilesetManager: TilesetResolver;
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
    members: readonly MeshableLayerChunk[]
  ): Map<ChunkGeometryKey, THREE.BufferGeometry> {
    const result = new Map<ChunkGeometryKey, THREE.BufferGeometry>();
    for (const [key, data] of this.buildChunkMeshData(members)) {
      result.set(key, this.createGeometry(data));
    }

    return result;
  }

  buildChunkMeshData(
    members: readonly MeshableLayerChunk[]
  ): Map<ChunkGeometryKey, ChunkMeshData> {
    const result = new Map<ChunkGeometryKey, ChunkMeshData>();
    const startedAt = performance.now();
    if (!this.#mesh(members)) {
      return result;
    }

    this.#activeBuffers().forEach((buffer, slot) => {
      if (buffer === undefined || buffer.vertexCount === 0) {
        return;
      }

      const data = buffer.toMeshData();
      this.#count(data);
      result.set(this.#variants.geometryKeyAt(slot), data);
    });
    this.stats.buildTimeMs = performance.now() - startedAt;

    return result;
  }

  createGeometry(
    data: ChunkMeshData
  ): THREE.BufferGeometry {
    return data.kind === "quads" ?
      createQuadGeometry(data, this.#quadIndex) :
      PulledChunkGeometry.fromMeshData(data, this.faceTemplates);
  }

  #mesh(
    members: readonly MeshableLayerChunk[]
  ): boolean {
    const { stats } = this;
    stats.reset();

    const drawn = members.filter(({ chunk }) => chunk.voxelCount > 0);
    if (drawn.length === 0) {
      return false;
    }
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

    return true;
  }

  #activeBuffers(): readonly (FaceBuffer | undefined)[] {
    return this.pullsVertices ? this.#pulledBuffers : this.#buffers;
  }

  #resetBuffers(): void {
    for (const buffer of this.#activeBuffers()) {
      buffer?.reset(...this.#origin);
    }
  }

  #count(
    data: ChunkMeshData
  ): void {
    const { stats } = this;
    stats.vertices += data.vertexCount;
    stats.triangles += data.triangleCount;
    stats.geometries++;
    stats.bytesPerVertex = data.bytesPerVertex;
    stats.bytes += data.kind === "quads" ?
      quadMeshBytes(data) :
      PulledChunkGeometry.byteLength(data);
  }
}
