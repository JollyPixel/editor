// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import {
  enableTileClamping,
  enableTileWrapping
} from "../mesh/index.ts";
import type { TilesetManager } from "../tileset/TilesetManager.ts";
import type { MaterialCustomizerFn } from "../VoxelEngine.types.ts";

// CONSTANTS
/**
 * Thirty-two translucent buckets plus one fully opaque material per tileset.
 */
const kOpacitySteps = 32;

export type ChunkMaterial =
  | THREE.MeshLambertMaterial
  | THREE.MeshStandardMaterial;

export interface ChunkMaterialCacheOptions {
  tilesetManager: TilesetManager;
  /**
   * @default "lambert"
   */
  type?: "lambert" | "standard";
  /**
   * @default 0.1
   */
  alphaTest?: number;
  customizer?: MaterialCustomizerFn;
  /**
   * Greedy quads need tile-local UV repetition.
   * @default false
   */
  tileWrapping?: boolean;
}

/**
 * Caches shared chunk materials by tileset, opacity bucket, and cutout mode.
 * Layer opacity is applied through materials instead of vertex colors.
 */
export class ChunkMaterialCache {
  tileWrapping: boolean;

  #materials = new Map<string, ChunkMaterial>();
  #tilesetManager: TilesetManager;
  #type: "lambert" | "standard";
  #alphaTest: number;
  #customizer?: MaterialCustomizerFn;

  constructor(
    options: ChunkMaterialCacheOptions
  ) {
    const {
      tilesetManager,
      type = "lambert",
      alphaTest = 0.1,
      customizer,
      tileWrapping = false
    } = options;

    this.#tilesetManager = tilesetManager;
    this.#type = type;
    this.#alphaTest = alphaTest;
    this.#customizer = customizer;
    this.tileWrapping = tileWrapping;
  }

  resolve(
    tilesetId: string,
    opacity: number,
    cutout = false
  ): ChunkMaterial {
    const bucket = opacityBucket(opacity);
    const key = `${tilesetId}:${bucket}${cutout ? ":cutout" : ""}`;

    const cached = this.#materials.get(key);
    if (cached) {
      return cached;
    }

    const material = this.#create(
      tilesetId,
      bucket,
      cutout
    );
    this.#materials.set(key, material);

    return material;
  }

  #create(
    tilesetId: string,
    bucket: number,
    cutout: boolean
  ): ChunkMaterial {
    const { texture } = this.#tilesetManager.atlas(
      tilesetId
    );
    const transparent = bucket < kOpacitySteps;

    const options = {
      map: texture,
      side: cutout ? THREE.DoubleSide : THREE.FrontSide,
      alphaTest: this.#alphaTest,
      opacity: bucket / kOpacitySteps,
      transparent,
      depthWrite: true
    };

    const material = this.#type === "standard" ?
      new THREE.MeshStandardMaterial(options) :
      new THREE.MeshLambertMaterial(options);

    if (this.tileWrapping) {
      enableTileWrapping(material);
    }
    else {
      enableTileClamping(material);
    }
    this.#customizer?.(material, tilesetId);

    return material;
  }

  invalidate(
    tilesetId?: string
  ): void {
    if (tilesetId === undefined) {
      this.dispose();

      return;
    }

    const prefix = `${tilesetId}:`;
    for (const [key, material] of this.#materials) {
      if (key.startsWith(prefix)) {
        material.dispose();
        this.#materials.delete(key);
      }
    }
  }

  dispose(): void {
    for (const material of this.#materials.values()) {
      material.dispose();
    }
    this.#materials.clear();
  }
}

function opacityBucket(
  opacity: number
): number {
  if (opacity >= 1) {
    return kOpacitySteps;
  }

  return Math.min(
    kOpacitySteps - 1,
    Math.max(0, Math.round(opacity * kOpacitySteps))
  );
}
