// Import Third-party Dependencies
import type * as THREE from "three";
import { Emitter } from "@openally/emitt";
import type { OrbitFlyCamera } from "@jolly-pixel/engine";
import { TransformControls } from "@jolly-pixel/three";

// Import Internal Dependencies
import type {
  ModelBlock,
  ModelBlocks
} from "./blocks/index.ts";
import type {
  TransformLiveSync,
  TransformLock
} from "../collaboration/index.ts";

export type GizmoMode =
  | "translate"
  | "rotate"
  | "scale";
export type GizmoTarget =
  | "group"
  | "pivot"
  | "mesh";
export type GizmoSpace =
  | "world"
  | "local";

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

  #onDragStart = (): void => {
    this.#dragging = true;
    this.#camera.enabled = false;

    const block = this.#blocks.selected;
    if (block !== null) {
      this.#lock.claim(block.uuid);
    }
  };

  #onDragEnd = (): void => {
    this.#dragging = false;
    this.#camera.enabled = true;

    const block = this.#blocks.selected;
    if (block === null) {
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
      this.#live.publish(
        block.uuid,
        block.transform
      );
    }
  };

  #sync = (): void => {
    const block = this.#blocks.selected;
    const config = this.#config;
    if (
      config === null ||
      block === null ||
      this.#lock.lockedBy(block.uuid) !== null
    ) {
      this.controls.enabled = false;
      this.controls.detach();

      return;
    }

    this.controls.mode = config.mode;
    this.controls.orientation = config.space ?? "world";
    this.controls.attach(
      resolveTarget(block, config.target)
    );
    this.controls.enabled = true;
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
      options.canvas,
      {
        appearance: {
          size: 0.200,
          handle: {
            kind: "sphere"
          },
          center: {
            interactive: true
          },
          planes: {
            inset: 0.065,
            size: 0.30
          },
          rings: {
            frontOnly: false
          },
          flipTowardCamera: true,
          viewRing: false,
          outline: {
            color: "#292a2c",
            width: 2.5
          }
        }
      }
    );
    options.scene.add(this.controls.helper);

    this.controls.addEventListener(
      "start",
      this.#onDragStart
    );
    this.controls.addEventListener(
      "change",
      this.#onObjectChange
    );
    this.controls.addEventListener(
      "end",
      this.#onDragEnd
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
      "start",
      this.#onDragStart
    );
    this.controls.removeEventListener(
      "change",
      this.#onObjectChange
    );
    this.controls.removeEventListener(
      "end",
      this.#onDragEnd
    );
    this.controls.helper.removeFromParent();
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
