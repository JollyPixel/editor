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
  FACE_OFFSETS,
  FACE_OPPOSITE
} from "./math.ts";
import { BlockVariantCache } from "./BlockVariantCache.ts";
import { GeometryBuffer } from "./GeometryBuffer.ts";
import {
  ChunkNeighbourhood,
  type LayerChunkCache
} from "./ChunkNeighbourhood.ts";
import type { VoxelEntry } from "../world/types.ts";

export interface VoxelMeshBuilderOptions {
  world: VoxelWorld;
  blockRegistry: BlockRegistry;
  shapeRegistry: BlockShapeRegistry;
  tilesetManager: TilesetManager;
}

/**
 * Builds per-tileset THREE.BufferGeometries for one chunk using naive face culling.
 *
 * Algorithm: for each filled voxel, emit only the faces where the adjacent
 * voxel in the face's direction either does not exist or does not occlude.
 * Non-axis-aligned faces (slopes, corners) correctly rotate their culling
 * direction before the neighbour lookup.
 *
 * Voxels at a position already occupied by a higher-priority layer are skipped
 * entirely (the higher layer's chunk will render that position instead).
 *
 * Geometry is split by tileset so each resulting mesh can be assigned the
 * correct material/texture when multiple tilesets are in use.
 *
 * Greedy meshing is intentionally omitted: it is incompatible with per-face UV
 * rotation and the non-cube shapes supported by this renderer.
 *
 * Everything that does not depend on a voxel's world position is hoisted out
 * of the per-voxel loop: rotated vertices, normals and atlas UVs are compiled
 * once per (block, transform) pair by `BlockVariantCache`, neighbour chunks are
 * resolved once per chunk by `ChunkNeighbourhood`, and vertex data is written
 * directly into typed arrays by `GeometryBuffer`.
 */
export class VoxelMeshBuilder {
  #world: VoxelWorld;
  #tilesetManager: TilesetManager;
  #variants: BlockVariantCache;

  /** One reusable accumulator per tileset slot, kept across chunk builds. */
  #buffers: (GeometryBuffer | undefined)[] = [];

  constructor(
    options: VoxelMeshBuilderOptions
  ) {
    this.#world = options.world;
    this.#tilesetManager = options.tilesetManager;
    this.#variants = new BlockVariantCache({
      blockRegistry: options.blockRegistry,
      shapeRegistry: options.shapeRegistry,
      tilesetManager: options.tilesetManager
    });
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
    // No tileset registered yet — cannot compute UVs. Return null so the
    // caller skips mesh creation; loadTileset() will mark chunks dirty and
    // trigger a rebuild once the texture is available.
    if (this.#tilesetManager.defaultTilesetId === null || chunk.voxelCount === 0) {
      return null;
    }
    this.#variants.refresh();

    const chunkSize = this.#world.chunkSize;
    const worldOriginX = (chunk.cx * chunkSize) + layer.offset.x;
    const worldOriginY = (chunk.cy * chunkSize) + layer.offset.y;
    const worldOriginZ = (chunk.cz * chunkSize) + layer.offset.z;

    // Culling reads one voxel outside the chunk on every axis.
    const neighbourhood = new ChunkNeighbourhood(
      this.#world,
      worldOriginX - 1,
      worldOriginY - 1,
      worldOriginZ - 1
    );
    const { layers } = neighbourhood;
    const layerCount = layers.length;
    const selfIndex = neighbourhood.indexOf(layer);

    const alpha = Math.round(layer.opacity * 255);
    const buffers = this.#resetBuffers();
    const size = chunk.size;
    // Decoding the linear index costs two divisions and two modulos per voxel;
    // a power-of-two chunk size turns both into shifts and masks.
    const shift = (size & (size - 1)) === 0 ? Math.log2(size) : -1;
    const mask = size - 1;
    let emitted = false;

    for (const [linearIdx, entry] of chunk.entries()) {
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

      if (!this.#winsCompositing(layers, layerCount, selfIndex, entry, wx, wy, wz)) {
        continue;
      }

      const variant = this.#variants.get(entry.blockId, entry.transform);
      if (variant === null) {
        continue;
      }

      for (const face of variant.faces) {
        const { cull } = face;
        if (cull >= 0) {
          const offset = FACE_OFFSETS[cull];
          const hidden = this.#isNeighbourFaceHidden(
            layers,
            layerCount,
            wx + offset[0],
            wy + offset[1],
            wz + offset[2],
            FACE_OPPOSITE[cull]
          );
          if (hidden) {
            continue;
          }
        }

        let buffer = buffers[face.slot];
        if (buffer === undefined) {
          buffer = new GeometryBuffer();
          buffers[face.slot] = buffer;
        }
        buffer.addFace(face, wx, wy, wz, alpha);
        emitted = true;
      }
    }

    return emitted ? this.#collectGeometries() : null;
  }

  /**
   * True when this chunk's `entry` is the voxel the world composites at
   * (wx, wy, wz) — i.e. no higher-priority layer covers the position.
   *
   * `selfIndex` is the owning layer's rank among the effectively visible
   * layers, so only the layers above it need a lookup. It is -1 when the layer
   * is hidden or fully transparent, in which case another layer always wins
   * and every voxel is skipped.
   */
  // eslint-disable-next-line max-params
  #winsCompositing(
    layers: readonly LayerChunkCache[],
    layerCount: number,
    selfIndex: number,
    entry: VoxelEntry,
    wx: number,
    wy: number,
    wz: number
  ): boolean {
    for (let i = 0; i < layerCount; i++) {
      if (i === selfIndex) {
        return true;
      }

      const found = layers[i].entryAt(wx, wy, wz);
      if (found !== undefined) {
        return found === entry;
      }
    }

    return false;
  }

  /**
   * Returns true if the neighbour voxel exists, belongs to a fully opaque
   * layer (opacity 1), and its shape occludes `oppFace` — the world-space face
   * pointing back toward this voxel. Returns false if the neighbour is empty,
   * its owning layer is translucent (opacity < 1, e.g. glass — never
   * occludes), or its shape does not occlude that face.
   */
  // eslint-disable-next-line max-params
  #isNeighbourFaceHidden(
    layers: readonly LayerChunkCache[],
    layerCount: number,
    nx: number,
    ny: number,
    nz: number,
    oppFace: number
  ): boolean {
    for (let i = 0; i < layerCount; i++) {
      const cache = layers[i];
      const neighbour = cache.entryAt(nx, ny, nz);
      if (neighbour === undefined) {
        continue;
      }
      if (!cache.opaque) {
        return false;
      }

      const variant = this.#variants.get(neighbour.blockId, neighbour.transform);

      return variant !== null && (variant.occlusionMask & (1 << oppFace)) !== 0;
    }

    return false;
  }

  #resetBuffers(): (GeometryBuffer | undefined)[] {
    for (const buffer of this.#buffers) {
      buffer?.reset();
    }

    return this.#buffers;
  }

  #collectGeometries(): Map<string, THREE.BufferGeometry> | null {
    const result = new Map<string, THREE.BufferGeometry>();

    for (let slot = 0; slot < this.#buffers.length; slot++) {
      const buffer = this.#buffers[slot];
      if (buffer === undefined || buffer.vertexCount === 0) {
        continue;
      }

      result.set(this.#variants.tilesetIdAt(slot), buffer.toGeometry());
    }

    return result.size > 0 ? result : null;
  }
}
