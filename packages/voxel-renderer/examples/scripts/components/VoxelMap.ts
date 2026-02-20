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

export class VoxelMap extends ActorComponent {
  world = loadVoxelTiledMap("tilemap/experimental_map.tmj");

  constructor(actor: Actor<any>) {
    super({ actor, typeName: "VoxelMap" });
  }

  awake() {
    const world = this.world.get();

    const voxelRenderer = this.actor.getComponent(VoxelRenderer)!;
    voxelRenderer.load(world)
      .catch(console.error);
  }
}
