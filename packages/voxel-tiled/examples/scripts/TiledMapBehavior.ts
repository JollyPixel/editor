// Import Third-party Dependencies
import {
  AssetReference,
  type AssetReferenceGroup
} from "@jolly-pixel/asset";
import {
  Actor,
  ActorComponent
} from "@jolly-pixel/engine";
import { VoxelRenderer } from "@jolly-pixel/voxel.renderer/engine";

// Import Internal Dependencies
import { TiledMapAssetType } from "../../src/index.ts";

export class TiledMapBehavior extends ActorComponent {
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
      typeName: "TiledMapBehavior"
    });
  }

  awake() {
    const {
      world,
      tilesets
    } = this.getAsset(TiledMapBehavior.assets.tiledMap);

    const vr = this.actor.addComponentAndGet(VoxelRenderer, {
      tilesets
    });

    vr.engine.load(world, {
      mergeLayers: true
    });
  }
}
