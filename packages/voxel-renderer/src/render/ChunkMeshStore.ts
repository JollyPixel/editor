// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import type { VoxelCollider } from "../collision/VoxelCollider.ts";
import type { VoxelInspector } from "../inspector/index.ts";
import type { VoxelMeshBuilder } from "../mesh/index.ts";
import type { VoxelChunk } from "../world/VoxelChunk.ts";
import type { IterableLayerChunk } from "../world/VoxelWorld.ts";
import type { VoxelCoord } from "../world/types.ts";
import { NOOP_LOGGER, type VoxelLogger } from "../utils/logger.ts";
import type { ChunkMaterialCache } from "./ChunkMaterialCache.ts";
import type {
  ChunkMeshLayout,
  ChunkMeshTarget
} from "./ChunkMeshLayout.ts";

// CONSTANTS
const kShaderOnlyAttributes = ["tileRegion", "tileRepeat"];

export interface ChunkMeshEntry {
  target: ChunkMeshTarget;
  origin: VoxelCoord;
  members: readonly IterableLayerChunk[];
  meshes: THREE.Mesh[];
  visible: boolean;
}

export interface ChunkMeshStoreOptions {
  root: THREE.Group;
  layout: ChunkMeshLayout;
  meshBuilder: VoxelMeshBuilder;
  materials: ChunkMaterialCache;
  inspector: VoxelInspector;
  collider?: VoxelCollider | null;
  logger?: VoxelLogger;
  /**
   * @default false
   */
  retainVertexData?: boolean;
  /**
   * @default false
   */
  castShadow?: boolean;
  /**
   * @default false
   */
  receiveShadow?: boolean;
}

/**
 * Owns built chunk entries, inspector registrations, and collider registrations.
 * Materials belong to `ChunkMaterialCache` and are not disposed here.
 */
export class ChunkMeshStore {
  #entries = new Map<string, ChunkMeshEntry>();
  #placements = new Map<VoxelChunk, string>();
  #root: THREE.Group;
  #layout: ChunkMeshLayout;
  #meshBuilder: VoxelMeshBuilder;
  #materials: ChunkMaterialCache;
  #inspector: VoxelInspector;
  #collider: VoxelCollider | null;
  #logger: VoxelLogger;
  #retainVertexData: boolean;
  #castShadow: boolean;
  #receiveShadow: boolean;

  constructor(
    options: ChunkMeshStoreOptions
  ) {
    const {
      root,
      layout,
      meshBuilder,
      materials,
      inspector,
      collider = null,
      logger = NOOP_LOGGER,
      retainVertexData = false,
      castShadow = false,
      receiveShadow = false
    } = options;

    this.#root = root;
    this.#layout = layout;
    this.#meshBuilder = meshBuilder;
    this.#materials = materials;
    this.#inspector = inspector;
    this.#collider = collider;
    this.#logger = logger;
    this.#retainVertexData = retainVertexData;
    this.#castShadow = castShadow;
    this.#receiveShadow = receiveShadow;
  }

  * [Symbol.iterator](): IterableIterator<[string, ChunkMeshEntry]> {
    yield* this.#entries;
  }

  get castShadow(): boolean {
    return this.#castShadow;
  }

  set castShadow(
    value: boolean
  ) {
    this.#castShadow = value;
    for (const mesh of this.#meshes()) {
      mesh.castShadow = value;
    }
  }

  get receiveShadow(): boolean {
    return this.#receiveShadow;
  }

  set receiveShadow(
    value: boolean
  ) {
    this.#receiveShadow = value;
    for (const mesh of this.#meshes()) {
      mesh.receiveShadow = value;
    }
  }

  targetContaining(
    chunk: VoxelChunk
  ): ChunkMeshTarget | undefined {
    const key = this.#placements.get(chunk);

    return key === undefined ? undefined : this.#entries.get(key)?.target;
  }

  rebuild(
    target: ChunkMeshTarget
  ): void {
    const { key } = target;
    const members = this.#layout.membersOf(target);
    if (members.length === 0) {
      this.remove(key);

      return;
    }

    this.#logger.debug(`Rebuilding chunk '${key}'`);
    this.#discard(key);

    const geometries = this.#meshBuilder.buildChunkGeometries(members);
    const [first] = members;
    const origin = this.#layout.originOf(first.layer, first.chunk);
    const opacity = target.layer?.opacity ?? 1;
    const meshes: THREE.Mesh[] = [];
    for (const [geometryKey, geometry] of geometries) {
      const mesh = new THREE.Mesh(
        geometry,
        this.#materials.resolve(geometryKey, opacity)
      );
      mesh.name = `voxel_chunk_${key}:${geometryKey}`;
      mesh.position.set(origin.x, origin.y, origin.z);
      mesh.castShadow = this.#castShadow;
      mesh.receiveShadow = this.#receiveShadow;
      this.#materials.retain(mesh.material);
      if (!this.#retainVertexData) {
        mesh.onAfterRender = releaseShaderAttributes;
      }

      this.#root.add(mesh);
      mesh.updateWorldMatrix(true, false);
      meshes.push(mesh);
    }

    this.#entries.set(key, {
      target,
      origin,
      members,
      meshes,
      visible: true
    });
    for (const { chunk } of members) {
      this.#placements.set(chunk, key);
    }
    this.#inspector.registerChunk(
      key,
      meshes,
      this.#meshBuilder.stats,
      {
        origin,
        size: first.chunk.size
      }
    );

    if (this.#collider) {
      this.#logger.debug(
        `Rebuilding collision for chunk '${key}'`,
        { origin }
      );

      this.#collider.rebuildChunk(key, {
        origin,
        chunks: members.map(({ chunk }) => chunk),
        geometries
      });
    }
  }

  remove(
    key: string
  ): void {
    this.#logger.debug(`Removing chunk '${key}'`);

    this.#discard(key);
    this.#collider?.removeChunk(key);
  }

  unload(
    key: string
  ): void {
    this.#inspector.unregisterChunk(key);

    const entry = this.#entries.get(key);
    if (entry) {
      this.#disposeMeshes(entry);
      entry.meshes = [];
      entry.visible = false;
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
    for (const mesh of entry.meshes) {
      mesh.visible = !culled;
    }
    this.#inspector.cullChunk(key, culled);
  }

  clear(): void {
    this.#inspector.clear();

    for (const entry of this.#entries.values()) {
      this.#disposeMeshes(entry);
    }
    this.#entries.clear();
    this.#placements.clear();
  }

  * #meshes(): IterableIterator<THREE.Mesh> {
    for (const entry of this.#entries.values()) {
      yield* entry.meshes;
    }
  }

  #discard(
    key: string
  ): void {
    this.#inspector.unregisterChunk(key);

    const entry = this.#entries.get(key);
    if (!entry) {
      return;
    }

    this.#disposeMeshes(entry);
    this.#entries.delete(key);
    for (const { chunk } of entry.members) {
      if (this.#placements.get(chunk) === key) {
        this.#placements.delete(chunk);
      }
    }
  }

  #disposeMeshes(
    entry: ChunkMeshEntry
  ): void {
    for (const mesh of entry.meshes) {
      this.#root.remove(mesh);
      mesh.geometry.dispose();

      const materials = Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material];
      for (const material of materials) {
        this.#materials.release(material);
      }
    }
  }
}

function releaseShaderAttributes(
  this: THREE.Mesh
): void {
  for (const name of kShaderOnlyAttributes) {
    const attribute = this.geometry.getAttribute(name);
    if (attribute instanceof THREE.BufferAttribute) {
      attribute.array = attribute.array.slice(0, 0);
    }
  }
  this.onAfterRender = THREE.Object3D.prototype.onAfterRender;
}
