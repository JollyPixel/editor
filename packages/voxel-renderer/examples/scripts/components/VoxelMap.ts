// Import Third-party Dependencies
import {
  Actor,
  ActorComponent
} from "@jolly-pixel/engine";

// Import Internal Dependencies
import {
  loadVoxelTiledMap,
  VoxelRenderer
} from "../../../src/index.ts";

export class VoxelBehavior extends ActorComponent {
  world = loadVoxelTiledMap("tilemap/brackeys-level.tmj", {
    layerMode: "stacked"
  });
  // @ts-ignore
  voxelRenderer: VoxelRenderer;

  constructor(
    actor: Actor
  ) {
    super({
      actor,
      typeName: "VoxelBehavior"
    });
  }

  awake() {
    const world = this.world.get();

    const voxelRenderer = this.actor.getComponent(VoxelRenderer);
    if (!voxelRenderer) {
      throw new Error("VoxelRenderer component not found on actor");
    }
    this.voxelRenderer = voxelRenderer;
    voxelRenderer
      .load(world)
      .catch(console.error);
  }
}
