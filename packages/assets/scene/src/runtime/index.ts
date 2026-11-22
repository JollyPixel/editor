// Import Third-party Dependencies
import {
  CameraDefinition,
  LightDefinition,
  MeshDefinition,
  TextDefinition,
  type ThreeComponentPackage
} from "@jolly-pixel/backend.three";
import { RigidBodyDefinition } from "@jolly-pixel/physics/ecs";
import { ColliderOutline } from "@jolly-pixel/physics/three";

// CONSTANTS
export const CAMERA_DEFINITION = new CameraDefinition();
export const LIGHT_DEFINITION = new LightDefinition();
export const MESH_DEFINITION = new MeshDefinition();
export const TEXT_DEFINITION = new TextDefinition();
export const RIGID_BODY_DEFINITION = new RigidBodyDefinition(ColliderOutline);

export const RUNTIME_COMPONENTS: ThreeComponentPackage = {
  definitions: [
    CAMERA_DEFINITION,
    LIGHT_DEFINITION,
    MESH_DEFINITION,
    TEXT_DEFINITION,
    RIGID_BODY_DEFINITION
  ],
  usesPhysics: {
    [RIGID_BODY_DEFINITION.type]: () => true
  }
};
