// Import Third-party Dependencies
import type * as THREE from "three";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";
import { Emitter } from "@openally/emitt";
import type { OrbitFlyCamera } from "@jolly-pixel/engine";

// Import Internal Dependencies
import type {
  ModelBlock,
  ModelBlocks
} from "../model/index.ts";
import type {
  TransformLiveSync,
  TransformLock
} from "../collaboration/index.ts";

export type GizmoMode = "translate" | "rotate" | "scale";
export type GizmoTarget = "group" | "pivot" | "mesh";
export type GizmoSpace = "world" | "local";

export interface GizmoConfig {
  mode: GizmoMode;
  target: GizmoTarget;
  space?: GizmoSpace;
}

export interface TransformGizmoOptions {
  camera: OrbitFlyCamera;
  canvas: HTMLCanvasElement;
  scene: THREE.Object3D;
  blocks: ModelBlocks;
  lock: TransformLock;
  live: TransformLiveSync;
}

export type TransformGizmoEvents = {
  change: (block: ModelBlock) => void;
};

export class TransformGizmo extends Emitter<TransformGizmoEvents> {
  readonly controls: TransformControls;

  #camera: OrbitFlyCamera;
  #blocks: ModelBlocks;
  #lock: TransformLock;
  #live: TransformLiveSync;
  #config: GizmoConfig | null = null;
  #dragging = false;

  #onDraggingChanged = (
    event: { value: unknown; }
  ): void => {
    this.#dragging = event.value === true;
    this.#camera.enabled = !this.#dragging;

    const block = this.#blocks.selected;
    if (block === null) {
      return;
    }

    if (this.#dragging) {
      this.#lock.claim(block.uuid);

      return;
    }

    block.roundTransform();
    this.#blocks.commitTransform(block.uuid);
    this.#live.clear();
    this.#lock.release();
  };

  #onObjectChange = (): void => {
    const block = this.#blocks.selected;
    if (block === null) {
      return;
    }

    if (this.#config?.target === "pivot") {
      block.syncMeshToPivot();
    }
    this.emit("change", block);

    if (this.#dragging) {
      this.#live.publish(block.uuid, block.transform);
    }
  };

  #sync = (): void => {
    const block = this.#blocks.selected;
    const config = this.#config;
    if (block === null) {
      this.controls.detach();
    }

    if (
      config === null ||
      block === null ||
      this.#lock.lockedBy(block.uuid) !== null
    ) {
      this.controls.enabled = false;
      this.controls.getHelper().visible = false;

      return;
    }

    this.controls.attach(resolveTarget(block, config.target));
    this.controls.setMode(config.mode);
    this.controls.setSpace(config.space ?? "world");
    this.controls.enabled = true;
    this.controls.getHelper().visible = true;
  };

  constructor(
    options: TransformGizmoOptions
  ) {
    super();
    this.#camera = options.camera;
    this.#blocks = options.blocks;
    this.#lock = options.lock;
    this.#live = options.live;

    this.controls = new TransformControls(
      options.camera.threeCamera,
      options.canvas
    );
    this.controls.getHelper().visible = false;
    options.scene.add(this.controls.getHelper());

    this.controls.addEventListener(
      "dragging-changed",
      this.#onDraggingChanged
    );
    this.controls.addEventListener(
      "objectChange",
      this.#onObjectChange
    );
    this.#blocks.on("select", this.#sync);
    this.#lock.on("change", this.#sync);
  }

  get dragging(): boolean {
    return this.#dragging;
  }

  configure(
    config: GizmoConfig | null
  ): void {
    this.#config = config;
    this.#sync();
  }

  dispose(): void {
    this.#blocks.off("select", this.#sync);
    this.#lock.off("change", this.#sync);
    this.controls.removeEventListener(
      "dragging-changed",
      this.#onDraggingChanged
    );
    this.controls.removeEventListener(
      "objectChange",
      this.#onObjectChange
    );
    this.controls.detach();
    this.controls.getHelper().removeFromParent();
    this.controls.dispose();
  }
}

function resolveTarget(
  block: ModelBlock,
  target: GizmoTarget
): THREE.Object3D {
  switch (target) {
    case "pivot":
      return block.pivot;
    case "mesh":
      return block.mesh;
    default:
      return block.root;
  }
}
