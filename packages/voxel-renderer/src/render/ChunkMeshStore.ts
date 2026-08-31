// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import type { VoxelCollider } from "../collision/VoxelCollider.ts";
import type { VoxelDebugger } from "../debug/VoxelDebugger.ts";
import {
  VoxelMeshBuilder,
  ChunkGeometryKey
} from "../mesh/index.ts";
import type { VoxelLayer } from "../world/VoxelLayer.ts";
import type { VoxelChunk } from "../world/VoxelChunk.ts";
import { NOOP_LOGGER, type VoxelLogger } from "../utils/logger.ts";
import type { ChunkMaterialCache } from "./ChunkMaterialCache.ts";

export interface ChunkMeshEntry {
  layer: VoxelLayer;
  chunk: VoxelChunk;
  meshes: THREE.Mesh[];
  visible: boolean;
}

export interface ChunkMeshStoreOptions {
  root: THREE.Group;
  meshBuilder: VoxelMeshBuilder;
  materials: ChunkMaterialCache;
  debug: VoxelDebugger;
  collider?: VoxelCollider | null;
  logger?: VoxelLogger;
}

export interface ChunkMeshRemoveOptions {
  /**
   * @default true
   */
  collider?: boolean;
}

/**
 * Owns chunk meshes, debug registrations, and collider registrations.
 * Materials belong to `ChunkMaterialCache` and are not disposed here.
 */
export class ChunkMeshStore {
  #entries = new Map<string, ChunkMeshEntry>();
  #root: THREE.Group;
  #meshBuilder: VoxelMeshBuilder;
  #materials: ChunkMaterialCache;
  #debug: VoxelDebugger;
  #collider: VoxelCollider | null;
  #logger: VoxelLogger;

  constructor(
    options: ChunkMeshStoreOptions
  ) {
    const {
      root,
      meshBuilder,
      materials,
      debug,
      collider = null,
      logger = NOOP_LOGGER
    } = options;

    this.#root = root;
    this.#meshBuilder = meshBuilder;
    this.#materials = materials;
    this.#debug = debug;
    this.#collider = collider;
    this.#logger = logger;
  }

  * [Symbol.iterator](): IterableIterator<[string, ChunkMeshEntry]> {
    yield* this.#entries;
  }

  rebuild(
    layer: VoxelLayer,
    chunk: VoxelChunk
  ): void {
    const key = chunkKey(layer, chunk);
    this.#logger.debug(
      `Rebuilding chunk '${key}' with layer name '${layer.name}'`
    );

    this.remove(layer, chunk);

    const geometries = this.#meshBuilder.buildChunkGeometries(
      chunk,
      layer
    );
    if (!geometries) {
      this.#debug.registerChunk(
        key,
        [],
        this.#meshBuilder.stats
      );

      return;
    }

    const meshes: THREE.Mesh[] = [];
    for (const [geometryKey, geometry] of geometries) {
      const {
        tilesetId,
        cutout
      } = ChunkGeometryKey.parse(geometryKey);

      const mesh = new THREE.Mesh(
        geometry,
        this.#materials.resolve(
          tilesetId,
          layer.opacity,
          cutout
        )
      );
      mesh.name = `voxel_chunk_${key}:${geometryKey}`;

      this.#root.add(mesh);
      meshes.push(mesh);
    }

    this.#entries.set(key, {
      layer,
      chunk,
      meshes,
      visible: true
    });
    this.#debug.registerChunk(
      key,
      meshes,
      this.#meshBuilder.stats
    );

    if (this.#collider) {
      const layerOffset = layer.offset;
      this.#logger.debug(
        `Rebuilding collision for chunk '${key}' with layer name '${layer.name}'`,
        { offset: layerOffset }
      );

      this.#collider.rebuildChunk(key, {
        chunk,
        geometries,
        layerOffset
      });
    }
  }

  remove(
    layer: VoxelLayer,
    chunk: VoxelChunk,
    options: ChunkMeshRemoveOptions = {}
  ): void {
    const { collider = true } = options;
    const key = chunkKey(layer, chunk);
    this.#logger.debug(
      `Removing chunk '${key}' with layer name '${layer.name}'`
    );

    this.#debug.unregisterChunk(key);

    const entry = this.#entries.get(key);
    if (entry) {
      this.#disposeMeshes(entry);
      this.#entries.delete(key);
    }

    if (collider) {
      this.#collider?.removeChunk(key);
    }
  }

  cull(
    key: string,
    culled: boolean
  ): void {
    const entry = this.#entries.get(key);
    if (!entry) {
      return;
    }

    entry.visible = !culled;
    this.#debug.cullChunk(key, culled);
  }

  clear(): void {
    this.#debug.clear();

    for (const entry of this.#entries.values()) {
      this.#disposeMeshes(entry);
    }
    this.#entries.clear();
  }

  #disposeMeshes(
    entry: ChunkMeshEntry
  ): void {
    for (const mesh of entry.meshes) {
      this.#root.remove(mesh);
      mesh.geometry.dispose();
    }
  }
}

function chunkKey(
  layer: VoxelLayer,
  chunk: VoxelChunk
): string {
  return `${layer.id}:${chunk.toString()}`;
}
