// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import type { VoxelMeshBuilder } from "../meshing/VoxelMeshBuilder.ts";
import type { ChunkMaterialCache } from "../shading/ChunkMaterialCache.ts";
import type { ChunkMeshStore } from "../chunks/ChunkMeshStore.ts";
import type { BlockLight } from "../lighting/BlockLight.ts";
import {
  LightFalloff,
  type BlockLightFalloff
} from "../lighting/LightFalloff.ts";

export type { BlockLightFalloff };

export interface VoxelLightingOptions {
  /**
   * Strength of the ambient occlusion baked into chunk faces, from 0 (off)
   * to 1 (fully occluded corners turn black). Darkens the albedo, so it
   * shades direct and indirect light alike.
   * @default 0
   */
  ambientOcclusion?: number;

  /**
   * Strength of the light glowing blocks cast on their surroundings, 0 or
   * more. A block glows when its material group has a `lightLevel`.
   * @default 1
   */
  blockLight?: number;

  /**
   * How block light fades with distance. `"wide"` loses brightness slowly
   * and reaches every cell in range evenly; `"focused"` is twice as bright
   * next to the source and fades fast, like a lamp.
   * @default "wide"
   */
  blockLightFalloff?: BlockLightFalloff;

  /**
   * How much block light washes out received shadows, 0 or more. `0` keeps
   * shadows whole; at `1` a shadow vanishes where block light reaches full
   * brightness.
   * @default 0
   */
  shadowFill?: number;

  /**
   * Chunk meshes cast shadows.
   * @default false
   */
  castShadow?: boolean;

  /**
   * Chunk meshes receive shadows.
   * @default false
   */
  receiveShadow?: boolean;
}

export interface VoxelLightingContext {
  meshBuilder: VoxelMeshBuilder;
  materials: ChunkMaterialCache;
  meshes: ChunkMeshStore;
  remesh: (source: string) => void;
  light: BlockLight;
}

export class VoxelLighting {
  #context: VoxelLightingContext;
  #blockLight = 1;

  constructor(
    context: VoxelLightingContext,
    options: VoxelLightingOptions = {}
  ) {
    const {
      ambientOcclusion = 0,
      blockLight = 1,
      blockLightFalloff = "wide",
      shadowFill = 0,
      castShadow = false,
      receiveShadow = false
    } = options;

    this.#context = context;
    this.ambientOcclusion = ambientOcclusion;
    this.blockLight = blockLight;
    this.blockLightFalloff = blockLightFalloff;
    this.shadowFill = shadowFill;
    this.castShadow = castShadow;
    this.receiveShadow = receiveShadow;
  }

  get ambientOcclusion(): number {
    return this.#context.materials.aoStrength.value;
  }

  set ambientOcclusion(
    value: number
  ) {
    const { materials, meshBuilder, remesh } = this.#context;
    const strength = THREE.MathUtils.clamp(value, 0, 1);
    materials.aoStrength.value = strength;

    const enabled = strength > 0;
    if (enabled !== meshBuilder.ambientOcclusion) {
      meshBuilder.ambientOcclusion = enabled;
      remesh("ambientOcclusion");
    }
  }

  get blockLight(): number {
    return this.#blockLight;
  }

  set blockLight(
    value: number
  ) {
    this.#blockLight = Math.max(0, value);
    this.#syncStrength();
  }

  get blockLightFalloff(): BlockLightFalloff {
    return this.#context.light.falloff.name;
  }

  set blockLightFalloff(
    value: BlockLightFalloff
  ) {
    const falloff = LightFalloff.fromName(value);
    if (falloff === this.#context.light.falloff) {
      return;
    }

    this.#context.light.falloff = falloff;
    this.#syncStrength();
  }

  get shadowFill(): number {
    return this.#context.materials.blockLight.shadowFill.value;
  }

  set shadowFill(
    value: number
  ) {
    this.#context.materials.blockLight.shadowFill.value = Math.max(0, value);
  }

  get castShadow(): boolean {
    return this.#context.meshes.castShadow;
  }

  set castShadow(
    value: boolean
  ) {
    this.#context.meshes.castShadow = value;
  }

  get receiveShadow(): boolean {
    return this.#context.meshes.receiveShadow;
  }

  set receiveShadow(
    value: boolean
  ) {
    this.#context.meshes.receiveShadow = value;
  }

  #syncStrength(): void {
    this.#context.materials.blockLight.strength.value = this.#blockLight *
      this.#context.light.falloff.peak;
  }
}
