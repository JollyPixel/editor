// Import Third-party Dependencies
import * as THREE from "three";
import {
  ActorComponent,
  type Actor,
  type OrbitFlyCamera
} from "@jolly-pixel/engine";

// Import Internal Dependencies
import type { ModelBlocks } from "../model/index.ts";
import type { TransformGizmo } from "./TransformGizmo.ts";

export interface BlockPickerOptions {
  camera: OrbitFlyCamera;
  blocks: ModelBlocks;
  gizmo: TransformGizmo;
}

export class BlockPicker extends ActorComponent {
  #camera: OrbitFlyCamera;
  #blocks: ModelBlocks;
  #gizmo: TransformGizmo;
  #raycaster = new THREE.Raycaster();
  #pointer = new THREE.Vector2();

  constructor(
    actor: Actor,
    options: BlockPickerOptions
  ) {
    super({
      actor,
      typeName: "BlockPicker"
    });
    this.#camera = options.camera;
    this.#blocks = options.blocks;
    this.#gizmo = options.gizmo;
  }

  update(): void {
    const { mouse } = this.actor.world.input;
    if (
      !mouse.wasJustPressed("left") ||
      this.#gizmo.dragging
    ) {
      return;
    }

    const { x, y } = mouse.viewportPosition;
    this.#raycaster.setFromCamera(
      this.#pointer.set(x, y),
      this.#camera.threeCamera
    );

    const meshes = [
      ...this.#blocks.values()
    ].map((block) => block.mesh);
    const [hit] = this.#raycaster.intersectObjects(meshes, false);

    if (hit === undefined) {
      this.#blocks.select(null);

      return;
    }

    const block = this.#blocks.fromMesh(hit.object);
    if (block) {
      this.#blocks.select(block);
    }
  }
}
