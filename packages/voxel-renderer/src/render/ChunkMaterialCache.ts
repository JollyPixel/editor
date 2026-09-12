// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import {
  enableTileClamping,
  enableTileWrapping
} from "../mesh/index.ts";
import type { TilesetManager } from "../tileset/TilesetManager.ts";
import type { MaterialCustomizerFn } from "../VoxelEngine.types.ts";
import { BlockSurface } from "../blocks/BlockSurface.ts";
import { ChunkGeometryKey } from "../mesh/ChunkGeometryKey.ts";

export type ChunkMaterial =
  | THREE.MeshLambertMaterial
  | THREE.MeshStandardMaterial;

export interface ChunkMaterialCacheOptions {
  tilesetManager: TilesetManager;
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
}

/**
 * Caches shared chunk materials by atlas, exact opacity, and surface policy.
 * Layer opacity is applied through materials instead of vertex colors.
 */
export class ChunkMaterialCache {
  tileWrapping: boolean;

  #materials = new Map<string, ChunkMaterial>();
  #keys = new Map<THREE.Material, string>();
  #references = new Map<THREE.Material, number>();
  #tilesetManager: TilesetManager;
  #type: "lambert" | "standard";
  #customizer?: MaterialCustomizerFn;

  constructor(
    options: ChunkMaterialCacheOptions
  ) {
    const {
      tilesetManager,
      type = "lambert",
      customizer,
      tileWrapping = false
    } = options;

    this.#tilesetManager = tilesetManager;
    this.#type = type;
    this.#customizer = customizer;
    this.tileWrapping = tileWrapping;
  }

  resolve(
    tilesetId: string,
    opacity: number,
    surface: BlockSurface | boolean = false
  ): ChunkMaterial {
    const resolved = typeof surface === "boolean"
      ? new BlockSurface({ alphaMode: surface ? "blend" : "opaque" })
      : surface;
    const key = new ChunkGeometryKey(
      tilesetId,
      resolved
    ).toString() + `:opacity=${opacity}`;

    const cached = this.#materials.get(key);
    if (cached) {
      return cached;
    }

    const material = this.#create(
      tilesetId,
      opacity,
      resolved
    );
    this.#materials.set(key, material);
    this.#keys.set(material, key);

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
    const key = this.#keys.get(material);
    if (key !== undefined) {
      this.#materials.delete(key);
      this.#keys.delete(material);
      material.dispose();
    }
    this.#references.delete(material);
  }

  #create(
    tilesetId: string,
    opacity: number,
    surface: BlockSurface
  ): ChunkMaterial {
    const { texture } = this.#tilesetManager.atlas(
      tilesetId
    );
    const transparent = opacity < 1 || surface.alphaMode === "blend";

    const options = {
      map: texture,
      side: surface.side === "double" ? THREE.DoubleSide : THREE.FrontSide,
      alphaTest: 0,
      opacity,
      transparent,
      depthWrite: !transparent,
      forceSinglePass: true
    };

    const material = this.#type === "standard" ?
      new THREE.MeshStandardMaterial(options) :
      new THREE.MeshLambertMaterial(options);

    if (this.tileWrapping) {
      enableTileWrapping(material, surface);
    }
    else {
      enableTileClamping(material, surface);
    }
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

    const prefix = `${tilesetId}:`;
    for (const [key, material] of this.#materials) {
      if (key.startsWith(prefix)) {
        material.dispose();
        this.#keys.delete(material);
        this.#references.delete(material);
        this.#materials.delete(key);
      }
    }
  }

  dispose(): void {
    for (const material of this.#materials.values()) {
      material.dispose();
    }

    this.#materials.clear();
    this.#keys.clear();
    this.#references.clear();
  }
}
