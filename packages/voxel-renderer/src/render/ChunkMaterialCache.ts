// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import {
  enableTileClamping,
  enableTileWrapping
} from "../mesh/index.ts";
import { AtlasAverages } from "../tileset/AtlasAverages.ts";
import type { TilesetManager } from "../tileset/TilesetManager.ts";
import type { MaterialCustomizerFn } from "../VoxelView.ts";
import type { BlockSurface } from "../blocks/BlockSurface.ts";
import type { ChunkGeometryKey } from "../mesh/ChunkGeometryKey.ts";
import { createAoStrength } from "../mesh/ambientOcclusion.ts";
import type { MaterialGroup } from "../materials/MaterialGroup.ts";
import type { MaterialGroupList } from "../materials/MaterialGroupList.ts";

// CONSTANTS
const kCoveredFaceOffset = -1;

export type ChunkMaterial =
  | THREE.MeshLambertMaterial
  | THREE.MeshStandardMaterial;

interface ChunkMaterialEntry {
  key: string;
  material: ChunkMaterial;
  tilesetId: string;
  surface: BlockSurface;
}

export interface ChunkMaterialCacheOptions {
  tilesetManager: TilesetManager;
  materialGroups?: MaterialGroupList;
  /**
   * @default "lambert"
   */
  type?: "lambert" | "standard";
  customizer?: MaterialCustomizerFn;
  /**
   * Greedy quads need tile-local UV repetition.
   * @default false
   */
  tileWrapping?: boolean;
  /**
   * Distant faces fade to the average colour of their atlas rect.
   * @default true
   */
  tileAveraging?: boolean;
  /**
   * Ambient occlusion strength shared by every chunk material, 0 to 1.
   * @default 0
   */
  ambientOcclusion?: number;
}

/**
 * Caches shared chunk materials by atlas, exact opacity, and surface policy.
 * Layer opacity is applied through materials instead of vertex colors.
 */
export class ChunkMaterialCache {
  tileWrapping: boolean;
  tileAveraging: boolean;
  readonly aoStrength: ReturnType<typeof createAoStrength>;

  #materials = new Map<string, ChunkMaterial>();
  #entries = new Map<THREE.Material, ChunkMaterialEntry>();
  #references = new Map<THREE.Material, number>();
  #tilesetManager: TilesetManager;
  #materialGroups: MaterialGroupList | undefined;
  #type: "lambert" | "standard";
  #customizer?: MaterialCustomizerFn;

  constructor(
    options: ChunkMaterialCacheOptions
  ) {
    const {
      tilesetManager,
      materialGroups,
      type = "lambert",
      customizer,
      tileWrapping = false,
      tileAveraging = true,
      ambientOcclusion = 0
    } = options;

    this.#tilesetManager = tilesetManager;
    this.#materialGroups = materialGroups;
    this.#type = type;
    this.#customizer = customizer;
    this.tileWrapping = tileWrapping;
    this.tileAveraging = tileAveraging;
    this.aoStrength = createAoStrength(ambientOcclusion);
  }

  resolve(
    geometryKey: ChunkGeometryKey,
    opacity: number
  ): ChunkMaterial {
    const { tilesetId, surface } = geometryKey;
    const key = `${geometryKey}:opacity=${opacity}`;

    const cached = this.#materials.get(key);
    if (cached) {
      return cached;
    }

    const material = this.#create(
      tilesetId,
      opacity,
      surface
    );
    this.#materials.set(key, material);
    this.#entries.set(material, {
      key,
      material,
      tilesetId,
      surface
    });

    return material;
  }

  retain(
    material: THREE.Material
  ): void {
    this.#references.set(
      material,
      (this.#references.get(material) ?? 0) + 1
    );
  }

  release(
    material: THREE.Material
  ): void {
    const remaining = (this.#references.get(material) ?? 1) - 1;
    if (remaining > 0) {
      this.#references.set(material, remaining);

      return;
    }
    if (this.#entries.has(material)) {
      this.#evict(material);

      return;
    }
    this.#references.delete(material);
  }

  refreshGroup(
    groupId: string
  ): boolean {
    const group = this.#materialGroups?.get(groupId);
    let evicted = false;

    for (const { material, surface } of this.#entries.values()) {
      if (surface.materialGroup !== groupId) {
        continue;
      }

      const standard = material instanceof THREE.MeshStandardMaterial;
      if (
        group !== undefined &&
        standard === this.#usesStandard(group)
      ) {
        group.applyTo(material);
        continue;
      }

      this.#evict(material);
      evicted = true;
    }

    return evicted;
  }

  #create(
    tilesetId: string,
    opacity: number,
    surface: BlockSurface
  ): ChunkMaterial {
    const atlas = this.#tilesetManager.resolve(tilesetId);
    if (atlas === undefined) {
      throw new Error(
        `ChunkMaterialCache: tileset "${tilesetId}" is not loaded.`
      );
    }
    const { texture } = atlas;
    const transparent = opacity < 1 || surface.alphaMode === "blend";

    const options = {
      map: texture,
      side: surface.side === "double" ? THREE.DoubleSide : THREE.FrontSide,
      alphaTest: 0,
      opacity,
      transparent,
      depthWrite: !transparent,
      forceSinglePass: true,
      polygonOffset: !surface.occludes,
      polygonOffsetFactor: surface.occludes ? 0 : kCoveredFaceOffset,
      polygonOffsetUnits: surface.occludes ? 0 : kCoveredFaceOffset
    };

    const group = surface.materialGroup === undefined ?
      undefined :
      this.#materialGroups?.get(surface.materialGroup);
    const material = this.#usesStandard(group) ?
      new THREE.MeshStandardMaterial(options) :
      new THREE.MeshLambertMaterial(options);

    const averages = this.tileAveraging ?
      AtlasAverages.of(texture)?.texture :
      null;
    const enable = this.tileWrapping ?
      enableTileWrapping :
      enableTileClamping;
    enable(
      material,
      surface,
      this.aoStrength,
      averages
    );
    group?.applyTo(material);
    this.#customizer?.(
      material,
      tilesetId,
      surface
    );

    return material;
  }

  invalidate(
    tilesetId?: string
  ): void {
    if (tilesetId === undefined) {
      this.dispose();

      return;
    }

    for (const { material, tilesetId: id } of this.#entries.values()) {
      if (id === tilesetId) {
        this.#evict(material);
      }
    }
  }

  dispose(): void {
    for (const material of this.#materials.values()) {
      material.dispose();
    }

    this.#materials.clear();
    this.#entries.clear();
    this.#references.clear();
  }

  #usesStandard(
    group: MaterialGroup | undefined
  ): boolean {
    return this.#type === "standard" || group !== undefined;
  }

  #evict(
    material: THREE.Material
  ): void {
    const entry = this.#entries.get(material);
    if (entry !== undefined) {
      this.#materials.delete(entry.key);
      this.#entries.delete(material);
    }
    this.#references.delete(material);
    material.dispose();
  }
}
