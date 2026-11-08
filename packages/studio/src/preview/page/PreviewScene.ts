// Import Third-party Dependencies
import { Systems } from "@jolly-pixel/engine";
import { Teardown } from "@jolly-pixel/utils";
import * as THREE from "three/webgpu";

export class PreviewScene extends Systems.Scene {
  #teardown = new Teardown();

  constructor() {
    super("asset-preview");
  }

  override awake(): void {
    const { world } = this;
    const scene = world.sceneManager.graph.scene;

    const hemisphere = new THREE.HemisphereLight("#dfe8ff", "#3b3328", 1.2);
    const key = new THREE.DirectionalLight("#ffffff", 2);
    key.position.set(4, 8, 5);
    scene.add(hemisphere, key);

    const environment = world.sceneManager.graph.createEnvironment(world);
    environment.apply({
      background: null,
      environment: {
        kind: "room",
        intensity: 0.6
      },
      fog: {
        kind: "none"
      }
    });

    this.#teardown.defer(() => scene.remove(hemisphere, key));
    this.#teardown.defer(() => environment.dispose());
  }

  override destroy(): void {
    this.#teardown.run();
    super.destroy();
  }
}
