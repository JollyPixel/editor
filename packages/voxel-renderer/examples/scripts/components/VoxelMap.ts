// Import Third-party Dependencies
import {
  AssetReference,
  type AssetReferenceGroup
} from "@jolly-pixel/asset";
import {
  Actor,
  ActorComponent
} from "@jolly-pixel/engine";

// Import Internal Dependencies
import {
  VoxelRenderer
} from "../../../src/index.ts";
import { TiledMapAssetType } from "../../../src/plugins/tiled/index.ts";

/**
 * Builds a voxel renderer from a prepared tiled-map asset.
 */
export class VoxelBehavior extends ActorComponent {
  static readonly assets = {
    tiledMap: new AssetReference(
      "example.tiled-map",
      TiledMapAssetType
    )
  } satisfies AssetReferenceGroup;

  constructor(
    actor: Actor
  ) {
    super({
      actor,
      typeName: "VoxelBehavior"
    });
  }

  awake() {
    const {
      world,
      tilesets
    } = this.getAsset(VoxelBehavior.assets.tiledMap);

    const vr = this.actor.addComponentAndGet(VoxelRenderer, {
      tilesets
    });

    vr.engine.load(world, {
      mergeLayers: true
    });
  }
}
