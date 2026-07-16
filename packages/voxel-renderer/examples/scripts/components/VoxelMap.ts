// Import Third-party Dependencies
import {
  Actor,
  ActorComponent,
  type ComponentInitializeContext
} from "@jolly-pixel/engine";
import * as THREE from "three";

// Import Internal Dependencies
import {
  TilesetLoader,
  VoxelRenderer,
  type VoxelWorldJSON
} from "../../../src/index.ts";
import { loadVoxelTiledMap } from "../../../src/plugins/tiled/index.ts";

export class VoxelBehavior extends ActorComponent {
  tilesetLoader = new TilesetLoader();

  world: VoxelWorldJSON | undefined;

  async initialize(
    { assetManager }: ComponentInitializeContext
  ) {
    this.tilesetLoader = new TilesetLoader({
      manager: assetManager.context.manager
    });
    const mapLoader = loadVoxelTiledMap(
      this.actor.world.assetManager,
      "tilemap/brackeys-level.tmj",
      {
        layerMode: "stacked"
      }
    );

    this.world = await mapLoader.getAsync();
    console.log(this.world);
    await this.tilesetLoader.fromWorld(this.world);
  }

  constructor(
    actor: Actor
  ) {
    super({
      actor,
      typeName: "VoxelBehavior"
    });
  }

  awake() {
    if (!this.world) {
      throw new Error("world is not initialized");
    }

    const vr = this.actor.addComponentAndGet(VoxelRenderer, {
      material: "lambert",
      materialCustomizer: (material) => {
        if (material instanceof THREE.MeshStandardMaterial) {
          material.metalness = 0;
          material.roughness = 0.85;
        }
      },
      tilesetLoader: this.tilesetLoader
    });

    vr.engine.load(this.world, {
      mergeLayers: true
    });
  }
}
