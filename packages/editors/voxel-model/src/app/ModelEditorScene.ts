// Import Third-party Dependencies
import * as THREE from "three";
import { Systems } from "@jolly-pixel/engine";
import type * as network from "@jolly-pixel/network";

// Import Internal Dependencies
import { FreeFlyCamera } from "../scene/camera/FreeFlyCamera.ts";
import { ModelSceneComponent } from "./ModelSceneComponent.ts";
import type { EditorIdentity } from "../collaboration/identity.ts";
import type {
  ModelNetworkCommand,
  ModelServerMessage
} from "../network/types.ts";

export interface ModelEditorSceneOptions {
  room?: network.Room<ModelNetworkCommand, ModelServerMessage>;
  /** Absent offline, no collaboration is wired up. */
  identity?: EditorIdentity;
}

export interface ModelEditorSceneHandles {
  modelSceneComponent: ModelSceneComponent;
}

export class ModelEditorScene extends Systems.Scene {
  #room: network.Room<ModelNetworkCommand, ModelServerMessage> | undefined;
  #identity: EditorIdentity | undefined;
  #handles = Promise.withResolvers<ModelEditorSceneHandles>();

  get ready(): Promise<ModelEditorSceneHandles> {
    return this.#handles.promise;
  }

  constructor(
    options: ModelEditorSceneOptions = {}
  ) {
    super("model-editor");
    this.#room = options.room;
    this.#identity = options.identity;
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
      .addComponentAndGet(ModelSceneComponent, {
        camera,
        room: this.#room,
        identity: this.#identity
      });

    this.#handles.resolve({ modelSceneComponent });
  }

  override destroy(): void {
    this.#handles.reject(
      new Error("The model editor scene was destroyed before it awoke.")
    );
  }
}
