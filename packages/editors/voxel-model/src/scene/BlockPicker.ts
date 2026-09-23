// Import Third-party Dependencies
import * as THREE from "three";
import {
  ActorComponent,
  type Actor,
  type OrbitFlyCamera
} from "@jolly-pixel/engine";

// Import Internal Dependencies
import type { ModelBlocks } from "./blocks/index.ts";
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
  #meshes: THREE.Object3D[] = [];
  #meshesDirty = true;

  #onBlocksChanged = (): void => {
    this.#meshesDirty = true;
  };

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

    this.#blocks.on("blockAdded", this.#onBlocksChanged);
    this.#blocks.on("blockRemoved", this.#onBlocksChanged);
    this.addTeardown(() => {
      this.#blocks.off("blockAdded", this.#onBlocksChanged);
      this.#blocks.off("blockRemoved", this.#onBlocksChanged);
    });
  }

  update(): void {
    if (this.#gizmo.dragging) {
      return;
    }

    const { mouse } = this.actor.world.input;
    const { x, y } = mouse.viewportPosition;
    this.#raycaster.setFromCamera(
      this.#pointer.set(x, y),
      this.#camera.threeCamera
    );

    const [hit] = this.#raycaster.intersectObjects(this.#meshList(), false);
    const hoveredBlock = hit === undefined ?
      null :
      this.#blocks.fromMesh(hit.object) ?? null;
    this.#blocks.hover(hoveredBlock);

    if (mouse.wasJustPressed("left")) {
      this.#blocks.select(hoveredBlock);
    }
  }

  #meshList(): THREE.Object3D[] {
    if (this.#meshesDirty) {
      this.#meshes = [...this.#blocks.values()].map((block) => block.mesh);
      this.#meshesDirty = false;
    }

    return this.#meshes;
  }
}
