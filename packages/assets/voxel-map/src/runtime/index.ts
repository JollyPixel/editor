// Import Third-party Dependencies
import { PhysicsSystem } from "@jolly-pixel/physics/ecs";
import type { ThreeComponentPackage } from "@jolly-pixel/backend.three";
import { PhysicsVoxelCollider } from "@jolly-pixel/voxel.renderer";
import {
  VOXEL_MAP_ASSET,
  VoxelMapDefinition
} from "@jolly-pixel/voxel.renderer/engine";
import * as THREE from "three";

// Import Internal Dependencies
import { BlocksetLoader } from "./BlocksetLoader.ts";
import { GAME_BLOCKSET } from "./GameBlockset.ts";
import { VoxelMapLoader } from "./VoxelMapLoader.ts";

export * from "./BlocksetAtlasBridge.ts";
export * from "./BlocksetEntry.ts";
export * from "./BlocksetSurface.ts";

// CONSTANTS
export const VOXEL_MAP_DEFINITION = new VoxelMapDefinition({
  collider: (actor) => (context) => new PhysicsVoxelCollider({
    world: PhysicsSystem.require(actor.world).ownedBodies(actor),
    placement: new THREE.Matrix4().fromArray(actor.transform.global.matrix),
    ...context
  })
});

export const RUNTIME_COMPONENTS: ThreeComponentPackage = {
  definitions: [VOXEL_MAP_DEFINITION],
  loaders: [
    {
      type: VOXEL_MAP_ASSET,
      create: (manager) => new VoxelMapLoader(manager)
    },
    {
      type: GAME_BLOCKSET,
      create: (manager) => new BlocksetLoader(manager)
    }
  ],
  usesPhysics: {
    [VOXEL_MAP_DEFINITION.type]: (data) => (
      VOXEL_MAP_DEFINITION.parse(data).collision
    )
  }
};
