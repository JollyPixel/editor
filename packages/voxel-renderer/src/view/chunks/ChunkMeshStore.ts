// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import type { VoxelCollider } from "../collision/VoxelCollider.ts";
import type { VoxelInspector } from "../inspector/index.ts";
import {
  PulledChunkMesh,
  type ChunkGeometryKey,
  type MeshBuildStats,
  type PulledChunkGeometry,
  type VoxelMeshBuilder
} from "../meshing/index.ts";
import type { VoxelChunk } from "../../document/world/storage/VoxelChunk.ts";
import type { IterableLayerChunk } from "../../document/world/VoxelWorld.ts";
import type { VoxelCoord } from "../../document/world/types.ts";
import { NOOP_LOGGER, type VoxelLogger } from "../../VoxelLogger.ts";
import type { ChunkMaterialCache } from "../shading/ChunkMaterialCache.ts";
import {
  opacityOf,
  type ChunkMeshLayout,
  type ChunkMeshTarget
} from "./ChunkMeshLayout.ts";
import type { ChunkViewport } from "./ChunkViewport.ts";

export interface ChunkMeshEntry {
  target: ChunkMeshTarget;
  origin: VoxelCoord;
  members: readonly IterableLayerChunk[];
  meshes: THREE.Mesh[];
  geometryKeys: ChunkGeometryKey[];
  visible: boolean;
  far: boolean;
}

export interface ChunkRebuildPlan {
  target: ChunkMeshTarget;
  members: readonly IterableLayerChunk[];
  origin: VoxelCoord;
  far: boolean;
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
    target: ChunkMeshTarget,
    viewport: ChunkViewport
  ): void {
    const plan = this.plan(target, viewport);
    if (plan !== null) {
      this.build(plan);
    }
  }

  build(
    plan: ChunkRebuildPlan
  ): void {
    const geometries = this.#meshBuilder.buildChunkGeometries(plan.members);
    this.install(plan, geometries, this.#meshBuilder.stats);
  }

  plan(
    target: ChunkMeshTarget,
    viewport: ChunkViewport
  ): ChunkRebuildPlan | null {
    const { key } = target;
    const members = this.#layout.membersOf(target);
    if (members.length === 0) {
      this.remove(key);

      return null;
    }

    this.#logger.debug(`Rebuilding chunk '${key}'`);
    const [first] = members;
    const origin = this.#layout.originOf(first.layer, first.chunk);
    const far = viewport.isFar(origin, this.#entries.get(key)?.far);

    return {
      target,
      members,
      origin,
      far
    };
  }

  install(
    plan: ChunkRebuildPlan,
    geometries: Map<ChunkGeometryKey, PulledChunkGeometry>,
    stats: MeshBuildStats
  ): void {
    const {
      target,
      members,
      origin,
      far
    } = plan;
    const { key } = target;
    const [first] = members;
    this.#discard(key);

    const opacity = opacityOf(target);
    const meshes: THREE.Mesh[] = [];
    const geometryKeys: ChunkGeometryKey[] = [];
    for (const [geometryKey, geometry] of geometries) {
      const material = this.#materials.resolve(geometryKey, opacity, far);
      const mesh = new PulledChunkMesh(geometry, material);
      mesh.name = `voxel_chunk_${key}:${geometryKey}`;
      mesh.position.set(origin.x, origin.y, origin.z);
      mesh.castShadow = this.#castShadow;
      mesh.receiveShadow = this.#receiveShadow;
      this.#materials.retain(mesh.material);

      this.#root.add(mesh);
      mesh.updateWorldMatrix(true, false);
      meshes.push(mesh);
      geometryKeys.push(geometryKey);
    }

    this.#entries.set(key, {
      target,
      origin,
      members,
      meshes,
      geometryKeys,
      visible: true,
      far
    });
    for (const { chunk } of members) {
      this.#placements.set(chunk, key);
    }
    this.#inspector.registerChunk(
      key,
      meshes,
      stats,
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
        geometries: collisionGeometries(geometries)
      });
    }
  }

  applyFar(
    changes: Iterable<[key: string, far: boolean]>
  ): void {
    const released: THREE.Material[] = [];

    for (const [key, far] of changes) {
      const entry = this.#entries.get(key);
      if (!entry) {
        continue;
      }

      const opacity = opacityOf(entry.target);
      entry.meshes.forEach((mesh, index) => {
        const material = this.#materials.resolve(
          entry.geometryKeys[index],
          opacity,
          far
        );
        if (material === mesh.material) {
          return;
        }

        this.#materials.retain(material);
        released.push(mesh.material as THREE.Material);
        mesh.material = material;
      });
      entry.far = far;
    }

    for (const material of released) {
      this.#materials.release(material);
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
      entry.geometryKeys = [];
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

function collisionGeometries(
  geometries: Map<ChunkGeometryKey, PulledChunkGeometry>
): Map<ChunkGeometryKey, THREE.BufferGeometry> {
  const result = new Map<ChunkGeometryKey, THREE.BufferGeometry>();
  for (const [key, geometry] of geometries) {
    result.set(key, geometry.toIndexedGeometry());
  }

  return result;
}
