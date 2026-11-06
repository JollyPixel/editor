// Import Third-party Dependencies
import RAPIER from "@dimforge/rapier3d-compat";
import {
  DEFAULT_GRAVITY,
  type PhysicsBackend,
  type PhysicsWorldOptions
} from "@jolly-pixel/physics";

// Import Internal Dependencies
import { RapierWorld } from "./RapierWorld.ts";
import { copyVector } from "./vectors.ts";

export class RapierBackend implements PhysicsBackend {
  static #initialization: Promise<void> | null = null;

  static async load(): Promise<RapierBackend> {
    RapierBackend.#initialization ??= RAPIER.init();
    await RapierBackend.#initialization;

    return new RapierBackend();
  }

  readonly name = "rapier";

  createWorld(
    options: PhysicsWorldOptions = {}
  ): RapierWorld {
    const { gravity = DEFAULT_GRAVITY } = options;

    return new RapierWorld(
      new RAPIER.World(copyVector(gravity))
    );
  }
}
