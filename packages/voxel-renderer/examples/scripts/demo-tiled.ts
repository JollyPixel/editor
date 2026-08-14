// Import Third-party Dependencies
import {
  Camera3DControls,
  Systems
} from "@jolly-pixel/engine";
import {
  Runtime,
  loadRuntime
} from "@jolly-pixel/runtime";
import * as THREE from "three";

// Import Internal Dependencies
import { VoxelBehavior } from "./components/VoxelMap.ts";
import {
  TiledMapAssetLoader,
  TiledMapAssetType
} from "../../src/plugins/tiled/index.ts";
import {
  createExamplePane
} from "./utils/example-switcher.ts";

/**
 * Declares and constructs the tiled-map example scene.
 */
class TiledScene extends Systems.Scene {
  constructor() {
    super("tiled", {
      assets: [VoxelBehavior.assets]
    });
  }

  override awake(): void {
    const scene = this.world.sceneManager.getSource();
    scene.background = new THREE.Color("#211331");

    const dirLight = new THREE.DirectionalLight(
      new THREE.Color("#f6faff"),
      2
    );
    dirLight.position.set(20, 40, 30);
    scene.add(
      new THREE.AmbientLight(new THREE.Color("#ffffff"), 2.5),
      dirLight
    );

    this.world.createActor("camera")
      .addComponent(Camera3DControls, {}, (component) => {
        component.actor.transform
          .setLocalPosition({
            x: 15,
            y: 25,
            z: 42
          })
          .lookAt({
            x: 15,
            y: 0,
            z: 10
          });
      });

    this.world.createActor("map")
      .addComponent(VoxelBehavior);
  }
}

const canvas = document.querySelector("canvas") as HTMLCanvasElement | null;
if (!canvas) {
  throw new Error("HTMLCanvasElement not found");
}

const runtime = await Runtime.create(canvas, {
  includePerformanceStats: true,
  focusCanvas: false,
  assets: {
    catalog: "/assets.json",
    loaders: [
      {
        type: TiledMapAssetType,
        create(manager) {
          return new TiledMapAssetLoader(manager, {
            layerMode: "stacked"
          });
        }
      }
    ]
  }
});

const { world } = runtime;
world.logger.setLevel("debug");
world.logger.enableNamespace("*");

await loadRuntime(runtime, {
  scene: new TiledScene()
})
  .catch(console.error);

const pane = createExamplePane();
pane.hidden = true;
