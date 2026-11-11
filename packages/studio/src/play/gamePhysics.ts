// Import Third-party Dependencies
import type { PhysicsBackend } from "@jolly-pixel/physics";
import {
  PhysicsSystem,
  type EngineWorld
} from "@jolly-pixel/physics/engine";
import type {
  PhysicsEngine,
  PhysicsSection
} from "@jolly-pixel/server";

// CONSTANTS
const kBackends: Record<PhysicsEngine, () => Promise<PhysicsBackend>> = {
  rapier: async() => {
    const { RapierBackend } = await import("@jolly-pixel/physics.rapier");

    return RapierBackend.load();
  }
};

export async function attachPhysics(
  world: EngineWorld,
  physics: PhysicsSection
): Promise<PhysicsSystem> {
  const backend = await kBackends[physics.engine]();

  return PhysicsSystem.attach(world, backend, {
    gravity: physics.gravity
  });
}
