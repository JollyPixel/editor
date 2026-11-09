// Import Third-party Dependencies
import {
  CameraDefinition,
  LightDefinition,
  MeshDefinition,
  TextDefinition
} from "@jolly-pixel/engine";
import {
  PhysicsSystem,
  RigidBodyDefinition
} from "@jolly-pixel/physics/engine";
import type { RuntimeComponentPackage } from "@jolly-pixel/runtime";

// CONSTANTS
export const CAMERA_DEFINITION = new CameraDefinition();
export const LIGHT_DEFINITION = new LightDefinition();
export const MESH_DEFINITION = new MeshDefinition();
export const TEXT_DEFINITION = new TextDefinition();
export const RIGID_BODY_DEFINITION = new RigidBodyDefinition();

export const RUNTIME_COMPONENTS: RuntimeComponentPackage = {
  definitions: [
    CAMERA_DEFINITION,
    LIGHT_DEFINITION,
    MESH_DEFINITION,
    TEXT_DEFINITION,
    RIGID_BODY_DEFINITION
  ],
  async setup(world) {
    const { RapierBackend } = await import("@jolly-pixel/physics.rapier");
    PhysicsSystem.attach(world, await RapierBackend.load());
  }
};
