// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import type { VoxelCollider } from "../collision/VoxelCollider.ts";
import type { VoxelInspector } from "../inspector/index.ts";
import {
  PulledChunkGeometry,
  PulledChunkMesh,
  type ChunkGeometryKey,
  type DownsampledWorld,
  type MeshBuildStats,
  type VoxelMeshBuilder
} from "../mesh/index.ts";
import type { VoxelChunk } from "../world/VoxelChunk.ts";
import type { IterableLayerChunk } from "../world/VoxelWorld.ts";
import type { VoxelCoord } from "../world/types.ts";
import { NOOP_LOGGER, type VoxelLogger } from "../utils/logger.ts";
import type { ChunkMaterialCache } from "./ChunkMaterialCache.ts";
import type {
  ChunkMeshLayout,
  ChunkMeshTarget
} from "./ChunkMeshLayout.ts";
import {
  FULL_DETAIL,
  type ChunkDetail,
  type ChunkViewport
} from "./ChunkViewport.ts";

// CONSTANTS
const kShaderOnlyAttributes = ["tileRegion", "tileRepeat"];

export interface ChunkMeshEntry {
  target: ChunkMeshTarget;
  origin: VoxelCoord;
  members: readonly IterableLayerChunk[];
  meshes: THREE.Mesh[];
  geometryKeys: ChunkGeometryKey[];
  visible: boolean;
  detail: ChunkDetail;
}

export interface ChunkLodSource {
  world: DownsampledWorld;
  meshBuilder: VoxelMeshBuilder;
}

export interface ChunkRebuildPlan {
  target: ChunkMeshTarget;
  members: readonly IterableLayerChunk[];
  origin: VoxelCoord;
  detail: ChunkDetail;
  lod: ChunkLodSource | null;
}

export interface ChunkMeshStoreOptions {
  root: THREE.Group;
  layout: ChunkMeshLayout;
  meshBuilder: VoxelMeshBuilder;
  materials: ChunkMaterialCache;
  inspector: VoxelInspector;
  collider?: VoxelCollider | null;
  lod?: ChunkLodSource | null;
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
  viewport: ChunkViewport | null = null;

  #entries = new Map<string, ChunkMeshEntry>();
  #placements = new Map<VoxelChunk, string>();
  #root: THREE.Group;
  #layout: ChunkMeshLayout;
  #meshBuilder: VoxelMeshBuilder;
  #materials: ChunkMaterialCache;
  #inspector: VoxelInspector;
  #collider: VoxelCollider | null;
  #lod: ChunkLodSource | null;
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
      lod = null,
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
    this.#lod = lod;
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

  detailOf(
    chunk: VoxelChunk
  ): ChunkDetail | undefined {
    const key = this.#placements.get(chunk);

    return key === undefined ? undefined : this.#entries.get(key)?.detail;
  }

  rebuild(
    target: ChunkMeshTarget
  ): void {
    const plan = this.plan(target);
    if (plan !== null) {
      this.build(plan);
    }
  }

  build(
    plan: ChunkRebuildPlan
  ): void {
    const builder = plan.lod === null ? this.#meshBuilder : plan.lod.meshBuilder;
    const geometries = builder.buildChunkGeometries(
      plan.lod === null ?
        plan.members :
        plan.lod.world.sync(plan.members, (chunk) => this.#isCoarse(chunk))
    );
    this.install(plan, geometries, builder.stats);
  }

  plan(
    target: ChunkMeshTarget
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
    const detail = this.viewport?.detailOf(
      origin,
      this.#entries.get(key)?.detail
    ) ?? FULL_DETAIL;

    return {
      target,
      members,
      origin,
      detail,
      lod: detail.lod > 0 ? this.#lod : null
    };
  }

  install(
    plan: ChunkRebuildPlan,
    geometries: Map<ChunkGeometryKey, THREE.BufferGeometry>,
    stats: MeshBuildStats
  ): void {
    const {
      target,
      members,
      origin,
      detail,
      lod
    } = plan;
    const { key } = target;
    const [first] = members;
    this.#discard(key);

    const opacity = target.layer?.opacity ?? 1;
    const meshes: THREE.Mesh[] = [];
    const geometryKeys: ChunkGeometryKey[] = [];
    for (const [geometryKey, geometry] of geometries) {
      const material = this.#materials.resolve(geometryKey, opacity, detail.far);
      const mesh = geometry instanceof PulledChunkGeometry ?
        new PulledChunkMesh(geometry, material) :
        new THREE.Mesh(geometry, material);
      mesh.name = `voxel_chunk_${key}:${geometryKey}`;
      mesh.position.set(origin.x, origin.y, origin.z);
      mesh.scale.setScalar(lod === null ? 1 : lod.world.scale);
      mesh.castShadow = this.#castShadow;
      mesh.receiveShadow = this.#receiveShadow;
      this.#materials.retain(mesh.material);
      if (!this.#retainVertexData) {
        mesh.onAfterRender = releaseShaderAttributes;
      }

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
      detail
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

    if (this.#collider && lod === null) {
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

  applyDetails(
    changes: Iterable<[key: string, detail: ChunkDetail]>
  ): void {
    const released: THREE.Material[] = [];

    for (const [key, detail] of changes) {
      const entry = this.#entries.get(key);
      if (!entry) {
        continue;
      }

      const opacity = entry.target.layer?.opacity ?? 1;
      entry.meshes.forEach((mesh, index) => {
        const material = this.#materials.resolve(
          entry.geometryKeys[index],
          opacity,
          detail.far
        );
        if (material === mesh.material) {
          return;
        }

        this.#materials.retain(material);
        released.push(mesh.material as THREE.Material);
        mesh.material = material;
      });
      entry.detail = detail;
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

  #isCoarse(
    chunk: VoxelChunk
  ): boolean {
    return (this.detailOf(chunk)?.lod ?? 0) > 0;
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
  geometries: Map<ChunkGeometryKey, THREE.BufferGeometry>
): Map<ChunkGeometryKey, THREE.BufferGeometry> {
  const result = new Map<ChunkGeometryKey, THREE.BufferGeometry>();
  for (const [key, geometry] of geometries) {
    result.set(
      key,
      geometry instanceof PulledChunkGeometry ?
        geometry.toIndexedGeometry() :
        geometry
    );
  }

  return result;
}

// eslint-disable-next-line max-params
function releaseShaderAttributes(
  this: THREE.Mesh,
  _renderer: unknown,
  _scene: THREE.Scene,
  _camera: THREE.Camera,
  _geometry: THREE.BufferGeometry,
  material: THREE.Material
): void {
  if (material !== this.material) {
    return;
  }

  for (const name of kShaderOnlyAttributes) {
    const attribute = this.geometry.getAttribute(name);
    if (attribute instanceof THREE.BufferAttribute) {
      attribute.array = attribute.array.slice(0, 0);
    }
  }
  this.onAfterRender = THREE.Object3D.prototype.onAfterRender;
}
