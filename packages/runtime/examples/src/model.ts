// Import Third-party Dependencies
import {
  Camera3DControls,
  ModelRenderer,
  AssetTypes,
  Systems
} from "@jolly-pixel/engine";
import { AssetReference } from "@jolly-pixel/asset";
import * as THREE from "three";

// Import Internal Dependencies
import { PlayerBehavior } from "./components/PlayerBehavior.ts";
import { bootstrapRuntime } from "./utils/bootstrapRuntime.ts";

// CONSTANTS
const kTinyWitchModel = new AssetReference("tinywitch", AssetTypes.model);
const kStandardModel = new AssetReference("standard", AssetTypes.model);

/**
 * Declares and constructs the 3D-models example scene.
 */
class ModelsScene extends Systems.Scene {
  constructor() {
    super("models", {
      assets: [kTinyWitchModel, kStandardModel]
    });
  }

  override awake(): void {
    const scene = this.world.sceneManager.getSource();
    scene.background = null;
    scene.add(
      new THREE.GridHelper(
        10,
        10,
        new THREE.Color("#888888")
      ),
      new THREE.AmbientLight(new THREE.Color("#ffffff"), 1)
    );

    this.world.createActor("camera")
      .addComponent(Camera3DControls, { speed: 0.25, rotationSpeed: 0.50 }, (component) => {
        component.actor.transform
          .setLocalPosition({ x: 5, y: 5, z: 5 })
          .lookAt({ x: 0, y: 0, z: 0 });
      });

    this.world.createActor("tinyWitchModel")
      .addComponent(ModelRenderer, {
        asset: kTinyWitchModel
      }, (component) => {
        component.actor.object3D.position.set(-5, 0, 0);
      });

    this.world.createActor("player")
      .addComponent(ModelRenderer, {
        asset: kStandardModel
      })
      .addComponent(PlayerBehavior);
  }
}

await bootstrapRuntime({
  includePerformanceStats: true,
  assets: {
    catalog: "./assets.json"
  },
  scene: new ModelsScene()
});
