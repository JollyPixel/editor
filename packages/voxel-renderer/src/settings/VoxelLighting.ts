// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import type { VoxelMeshBuilder } from "../mesh/VoxelMeshBuilder.ts";
import type { ChunkMaterialCache } from "../render/ChunkMaterialCache.ts";
import type { ChunkMeshStore } from "../render/ChunkMeshStore.ts";

export interface VoxelLightingOptions {
  /**
   * Strength of the ambient occlusion baked into chunk faces, from 0 (off)
   * to 1 (fully occluded corners turn black). Darkens the albedo, so it
   * shades direct and indirect light alike.
   * @default 0
   */
  ambientOcclusion?: number;

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
}

export class VoxelLighting {
  #context: VoxelLightingContext;

  constructor(
    context: VoxelLightingContext
  ) {
    this.#context = context;
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
}
