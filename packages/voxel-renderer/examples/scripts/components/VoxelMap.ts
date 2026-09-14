// Import Third-party Dependencies
import {
  AssetReference,
  type AssetReferenceGroup
} from "@jolly-pixel/asset";
import {
  Actor,
  ActorComponent
} from "@jolly-pixel/engine";
import {
  TiledMapAssetType
} from "@jolly-pixel/asset.voxel-map/tiled.ts";
import {
  VoxelRenderer
} from "@jolly-pixel/asset.voxel-map/renderers/index.ts";

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
