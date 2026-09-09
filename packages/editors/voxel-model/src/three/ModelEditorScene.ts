// Import Third-party Dependencies
import * as THREE from "three";
import { Systems } from "@jolly-pixel/engine";

// Import Internal Dependencies
import { FreeFlyCamera } from "./camera/FreeFlyCamera.ts";
import { ModelSceneComponent } from "./ModelSceneComponent.ts";

export interface ModelEditorSceneHandles {
  modelSceneComponent: ModelSceneComponent;
}

export class ModelEditorScene extends Systems.Scene {
  #handles = Promise.withResolvers<ModelEditorSceneHandles>();

  get ready(): Promise<ModelEditorSceneHandles> {
    return this.#handles.promise;
  }

  constructor() {
    super("model-editor");
  }

  override awake(): void {
    const scene = this.world.sceneManager.getSource();
    scene.add(new THREE.GridHelper(10, 10));

    const camera = this.world
      .createActor("camera")
      .addComponentAndGet(FreeFlyCamera, {
        pivotPosition: { x: 0, y: 2, z: 0 },
        pitch: -0.3,
        initialTrailDistance: 12
      });

    const modelSceneComponent = this.world
      .createActor("model")
      .addComponentAndGet(ModelSceneComponent, { camera });

    this.#handles.resolve({ modelSceneComponent });
  }

  override destroy(): void {
    this.#handles.reject(
      new Error("The model editor scene was destroyed before it awoke.")
    );
  }
}
