// Import Internal Dependencies
import type { BlockRegistry } from "../../document/blocks/BlockRegistry.ts";
import type { BlockShapeRegistry } from "../../document/blocks/shape/BlockShapeRegistry.ts";
import type { BlendGroupList } from "../../document/materials/BlendGroupList.ts";
import type { TilesetResolver } from "./variants/types.ts";
import type {
  MeshableLayerChunk,
  MeshableLayerVisibility,
  MeshableWorld,
  PulledMeshData
} from "./types.ts";
import type { ChunkGeometryKey } from "./ChunkGeometryKey.ts";
import { BlockVariantCache } from "./variants/BlockVariantCache.ts";
import { FaceTemplateTable } from "./pulling/FaceTemplateTable.ts";
import { PulledFaceBuffer } from "./pulling/PulledFaceBuffer.ts";
import { PulledChunkGeometry } from "./pulling/PulledChunkGeometry.ts";
import { MeshBuildStats } from "./MeshBuildStats.ts";
import { ChunkMesher } from "./ChunkMesher.ts";
import { ChunkNeighbourhood } from "./neighbourhood/ChunkNeighbourhood.ts";
import type { VoxelLogger } from "../../VoxelLogger.ts";

// CONSTANTS
const kMaxWindowChunkSize = 64;

export interface VoxelMeshBuilderOptions {
  alphaTest?: number;
  world: MeshableWorld;
  blockRegistry: BlockRegistry;
  shapeRegistry: BlockShapeRegistry;
  atlases: TilesetResolver;
  /**
   * Bakes per-vertex ambient occlusion into each face record.
   * @default false
   */
  ambientOcclusion?: boolean;
  faceTemplates?: FaceTemplateTable;
  blendGroups?: BlendGroupList;
  logger?: VoxelLogger;
  visibility?: MeshableLayerVisibility;
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
  #visibility: MeshableLayerVisibility | undefined;
  #variants: BlockVariantCache;
  #mesher: ChunkMesher;
  #origin: [number, number, number] = [0, 0, 0];
  #buffers: (PulledFaceBuffer | undefined)[] = [];
  #bufferFor = (slot: number, blended = false): PulledFaceBuffer => {
    const target = blended ? this.#variants.blendedSlotOf(slot) : slot;
    let buffer = this.#buffers[target];
    if (buffer === undefined) {
      buffer = new PulledFaceBuffer(
        this.faceTemplates,
        undefined,
        this.#variants.geometryKeyAt(target).blended
      );
      buffer.reset(...this.#origin);
      this.#buffers[target] = buffer;
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
  #occluders = new Int8Array(0);

  constructor(
    options: VoxelMeshBuilderOptions
  ) {
    this.#world = options.world;
    this.#visibility = options.visibility;
    this.faceTemplates = options.faceTemplates ?? new FaceTemplateTable();
    this.ambientOcclusion = options.ambientOcclusion ?? false;
    this.#variants = new BlockVariantCache({
      blockRegistry: options.blockRegistry,
      shapeRegistry: options.shapeRegistry,
      atlases: options.atlases,
      blendGroups: options.blendGroups,
      alphaTest: options.alphaTest,
      logger: options.logger,
      regions: this.faceTemplates.regions
    });
    this.#mesher = new ChunkMesher(this.#variants);
  }

  buildChunkGeometries(
    members: readonly MeshableLayerChunk[]
  ): Map<ChunkGeometryKey, PulledChunkGeometry> {
    const result = new Map<ChunkGeometryKey, PulledChunkGeometry>();
    for (const [key, data] of this.buildChunkMeshData(members)) {
      result.set(key, this.createGeometry(data));
    }

    return result;
  }

  buildChunkMeshData(
    members: readonly MeshableLayerChunk[]
  ): Map<ChunkGeometryKey, PulledMeshData> {
    const result = new Map<ChunkGeometryKey, PulledMeshData>();
    const startedAt = performance.now();
    if (!this.#mesh(members)) {
      return result;
    }

    this.#buffers.forEach((buffer, slot) => {
      if (buffer === undefined || buffer.faceCount === 0) {
        return;
      }

      const data = buffer.toMeshData();
      this.#count(data);
      result.set(this.#variants.geometryKeyAt(slot), data);
    });
    this.stats.buildTimeMs = performance.now() - startedAt;

    return result;
  }

  writeRegions(
    blockId: number
  ): boolean {
    return this.#variants.writeRegions(blockId);
  }

  createGeometry(
    data: PulledMeshData
  ): PulledChunkGeometry {
    return PulledChunkGeometry.fromMeshData(data, this.faceTemplates);
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
      windowFor: this.#windowFor,
      occluders: this.ambientOcclusion ? this.#occludersFor(chunkSize) : null,
      visibility: this.#visibility
    });

    this.#origin = [worldOriginX, worldOriginY, worldOriginZ];
    for (const buffer of this.#buffers) {
      buffer?.reset(...this.#origin);
    }

    for (const member of drawn) {
      neighbourhood.self = member.layer;
      this.#mesher.mesh({
        chunk: member.chunk,
        neighbourhood,
        worldOriginX,
        worldOriginY,
        worldOriginZ,
        stats,
        bufferFor: this.#bufferFor,
        ambientOcclusion: this.ambientOcclusion
      });
    }

    return true;
  }

  #occludersFor(
    chunkSize: number
  ): Int8Array | null {
    if (chunkSize > kMaxWindowChunkSize) {
      return null;
    }

    const span = chunkSize + 4;
    if (this.#occluders.length !== span * span * span) {
      this.#occluders = new Int8Array(span * span * span);
    }

    return this.#occluders;
  }

  #count(
    data: PulledMeshData
  ): void {
    const { stats } = this;
    stats.vertices += data.vertexCount;
    stats.triangles += data.triangleCount;
    stats.geometries++;
    stats.bytesPerVertex = data.bytesPerVertex;
    stats.bytes += PulledChunkGeometry.byteLength(data);
  }
}
