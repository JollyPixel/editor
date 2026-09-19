// Import Third-party Dependencies
import { Systems, OrbitFlyCamera } from "@jolly-pixel/engine";
import { Grid } from "@jolly-pixel/three";
import type { PeerIdentity } from "@jolly-pixel/ui";

// Import Internal Dependencies
import { ModelSceneComponent } from "./ModelSceneComponent.ts";
import type { VoxelModelRoom } from "../network/types.ts";

export interface ModelEditorSceneOptions {
  room?: VoxelModelRoom;
  identity?: PeerIdentity;
}

export interface ModelEditorSceneHandles {
  modelSceneComponent: ModelSceneComponent;
}

export class ModelEditorScene extends Systems.Scene {
  #room: VoxelModelRoom | undefined;
  #identity: PeerIdentity | undefined;
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
    scene.add(new Grid({
      extent: 10,
      cell: {
        color: "#3a3a3a",
        thickness: 1.5
      },
      section: {
        show: false
      },
      fade: {
        from: "origin",
        distance: 100
      },
      axes: {
        show: true
      }
    }));

    const camera = this.world
      .createActor("camera")
      .addComponentAndGet(OrbitFlyCamera, {
        focusMode: "elastic",
        position: { x: 0, y: 1, z: 5 },
        pivotPosition: { x: 0, y: 2, z: 0 },
        pitch: -0.3,
        moveSpeed: 6,
        minMoveSpeed: 1,
        maxMoveSpeed: 60,
        scrollSpeed: 1,
        maxPivotDistance: 20,
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
