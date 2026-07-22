// Import Third-party Dependencies
import * as THREE from "three";
import { Systems } from "@jolly-pixel/engine";

// Import Internal Dependencies
import { CubeBehavior } from "./Cube.ts";
import type { UVRegion } from "../../../src/uv/UVRegion.ts";
import type { Vec2 } from "../../../src/types.ts";

export interface CubeFactoryOptions {
  world: Systems.World;
  canvasTexture: THREE.CanvasTexture;
}

/**
 * Owns the ECS side of a UV region's cube: actor creation/teardown. Kept
 * separate from CubeGallery so that class only has to know "one cube per
 * region", not how a cube is actually spawned into the world.
 */
export class CubeFactory {
  #world: Systems.World;
  #canvasTexture: THREE.CanvasTexture;

  constructor(
    options: CubeFactoryOptions
  ) {
    this.#world = options.world;
    this.#canvasTexture = options.canvasTexture;
  }

  create(
    region: UVRegion,
    textureSize: Vec2
  ): CubeBehavior {
    return this.#world.createActor(`uv-cube-${region.id}`).addComponentAndGet(CubeBehavior, {
      canvasTexture: this.#canvasTexture,
      region,
      textureSize
    });
  }

  destroy(
    cube: CubeBehavior
  ): void {
    cube.actor.destroy();
  }
}
