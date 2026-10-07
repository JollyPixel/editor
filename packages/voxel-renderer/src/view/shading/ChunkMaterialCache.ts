// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import {
  enableVertexPulling,
  type FaceTemplateTable
} from "../meshing/pulling/index.ts";
import { enableTileShading } from "./tileShading.ts";
import { AtlasAverages } from "../atlases/AtlasAverages.ts";
import { createAoStrength } from "./ambientOcclusionNodes.ts";
import { createBlockLightUniforms } from "./emissionNodes.ts";
import type { BlocksetAtlases } from "../atlases/BlocksetAtlases.ts";
import type { ChunkGeometryKey } from "../meshing/ChunkGeometryKey.ts";
import type { BlockSurface } from "../../document/blocks/BlockSurface.ts";
import type { MaterialGroup } from "../../document/materials/MaterialGroup.ts";
import type { MaterialGroupList } from "../../document/materials/MaterialGroupList.ts";

// CONSTANTS
const kCoveredFaceOffset = -1;
const kMaxIdleMaterials = 16;

export type ChunkMaterial =
  | THREE.MeshLambertMaterial
  | THREE.MeshStandardMaterial;

export type MaterialCustomizerFn = (
  material: ChunkMaterial,
  blocksetId: string,
  surface: BlockSurface
) => void;

interface ChunkMaterialEntry {
  key: string;
  material: ChunkMaterial;
  blocksetId: string;
  surface: BlockSurface;
  normal: THREE.Texture | null;
  relief: boolean;
}

export interface ChunkMaterialCacheOptions {
  atlases: BlocksetAtlases;
  faceTemplates: FaceTemplateTable;
  materialGroups?: MaterialGroupList;
  /**
   * @default "lambert"
   */
  type?: "lambert" | "standard";
  customizer?: MaterialCustomizerFn;
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
  alphaToCoverage?: boolean;
}

/**
 * Caches shared chunk materials by atlas and surface policy.
 */
export class ChunkMaterialCache {
  tileAveraging: boolean;
  alphaToCoverage: boolean;
  readonly aoStrength: ReturnType<typeof createAoStrength>;
  readonly blockLight = createBlockLightUniforms();
  readonly faceTemplates: FaceTemplateTable;

  #materials = new Map<string, ChunkMaterial>();
  #entries = new Map<THREE.Material, ChunkMaterialEntry>();
  #references = new Map<THREE.Material, number>();
  #idle = new Set<THREE.Material>();
  #atlases: BlocksetAtlases;
  #materialGroups: MaterialGroupList | undefined;
  #type: "lambert" | "standard";
  #customizer?: MaterialCustomizerFn;

  constructor(
    options: ChunkMaterialCacheOptions
  ) {
    const {
      atlases,
      faceTemplates,
      materialGroups,
      type = "lambert",
      customizer,
      tileAveraging = true,
      ambientOcclusion = 0,
      alphaToCoverage = false
    } = options;

    this.#atlases = atlases;
    this.#materialGroups = materialGroups;
    this.#type = type;
    this.#customizer = customizer;
    this.tileAveraging = tileAveraging;
    this.alphaToCoverage = alphaToCoverage;
    this.faceTemplates = faceTemplates;
    this.aoStrength = createAoStrength(ambientOcclusion);
  }

  resolve(
    geometryKey: ChunkGeometryKey,
    far = false
  ): ChunkMaterial {
    const key = `${geometryKey}:far=${far}`;

    const cached = this.#materials.get(key);
    if (cached) {
      return cached;
    }

    const entry = this.#create(key, geometryKey, far);
    this.#materials.set(key, entry.material);
    this.#entries.set(entry.material, entry);

    return entry.material;
  }

  retain(
    material: THREE.Material
  ): void {
    this.#idle.delete(material);
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
    this.#references.delete(material);
    if (this.#entries.has(material)) {
      this.#park(material);
    }
  }

  refreshGroup(
    groupId: string
  ): boolean {
    const group = this.#materialGroups?.get(groupId);
    let evicted = false;

    for (const entry of this.#entries.values()) {
      const { material, surface, normal, relief } = entry;
      if (surface.materialGroup !== groupId) {
        continue;
      }

      const standard = material instanceof THREE.MeshStandardMaterial;
      if (
        group !== undefined &&
        standard === this.#usesStandard(group) &&
        relief === hasRelief(normal, group)
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
    key: string,
    geometryKey: ChunkGeometryKey,
    far: boolean
  ): ChunkMaterialEntry {
    const { blocksetId, surface } = geometryKey;
    const atlas = this.#atlases.resolve(blocksetId);
    if (atlas === undefined) {
      throw new Error(
        `ChunkMaterialCache: blockset "${blocksetId}" is not loaded.`
      );
    }
    const { texture } = atlas;
    const blends = surface.alphaMode === "blend" && !far;
    const transparent = blends;
    const alphaToCoverage = this.alphaToCoverage &&
      surface.alphaMode === "mask";

    const options = {
      map: texture,
      side: surface.side === "double" ? THREE.DoubleSide : THREE.FrontSide,
      alphaTest: 0,
      transparent,
      depthWrite: !transparent,
      alphaToCoverage,
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
    const flat = far && averages !== null && averages !== undefined;
    const normal = flat ? null : atlas.normal;
    const relief = hasRelief(normal, group);
    const inputs = enableVertexPulling(
      material,
      this.faceTemplates,
      {
        blended: geometryKey.blended && !far,
        lightSpan: this.blockLight.span
      }
    );
    enableTileShading(material, inputs, {
      surface,
      aoStrength: this.aoStrength,
      blockLight: this.blockLight,
      averages,
      normal: relief ? normal : null,
      flat,
      alphaToCoverage
    });
    material.map = null;
    group?.applyTo(material);
    this.#customizer?.(
      material,
      blocksetId,
      surface
    );

    return {
      key,
      material,
      blocksetId,
      surface,
      normal,
      relief
    };
  }

  invalidate(
    blocksetId?: string
  ): void {
    if (blocksetId === undefined) {
      this.dispose();

      return;
    }

    for (const { material, blocksetId: id } of this.#entries.values()) {
      if (id === blocksetId) {
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
    this.#idle.clear();
  }

  #usesStandard(
    group: MaterialGroup | undefined
  ): boolean {
    return this.#type === "standard" || group !== undefined;
  }

  #park(
    material: THREE.Material
  ): void {
    this.#idle.add(material);
    if (this.#idle.size > kMaxIdleMaterials) {
      const [oldest] = this.#idle;
      this.#evict(oldest);
    }
  }

  #evict(
    material: THREE.Material
  ): void {
    this.#idle.delete(material);
    const entry = this.#entries.get(material);
    if (entry !== undefined) {
      this.#materials.delete(entry.key);
      this.#entries.delete(material);
    }
    this.#references.delete(material);
    material.dispose();
  }
}

function hasRelief(
  normal: THREE.Texture | null,
  group: MaterialGroup | undefined
): boolean {
  return normal !== null && (group === undefined || group.normalScale > 0);
}
