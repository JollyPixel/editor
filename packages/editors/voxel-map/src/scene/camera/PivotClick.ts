// Import Third-party Dependencies
import * as THREE from "three";
import { InputCombination } from "@jolly-pixel/controls";
import {
  Actor,
  ActorComponent
} from "@jolly-pixel/engine";

// Import Internal Dependencies
import type { PointerCapture } from "../../state/PointerCapture.ts";
import type { EditorCamera } from "./EditorCamera.ts";

// CONSTANTS
const kClickTravelThreshold = 6;

export interface PivotClickOptions {
  camera: Pick<EditorCamera, "pivotAt">;
  solid: THREE.Object3D;
  pointer: Pick<PointerCapture, "captured">;
}

export class PivotClick extends ActorComponent {
  #camera: Pick<EditorCamera, "pivotAt">;
  #solid: THREE.Object3D;
  #pointerCapture: Pick<PointerCapture, "captured">;
  #pointer = new THREE.Vector2();
  #travel: number | null = null;

  constructor(
    actor: Actor,
    options: PivotClickOptions
  ) {
    super({
      actor,
      typeName: "PivotClick"
    });
    this.#camera = options.camera;
    this.#solid = options.solid;
    this.#pointerCapture = options.pointer;
  }

  update(): void {
    const { input } = this.actor.world;
    const { mouse } = input;
    if (
      !InputCombination.Alt.evaluate(input) ||
      !mouse.hovering ||
      this.#pointerCapture.captured
    ) {
      this.#travel = null;

      return;
    }

    if (mouse.wasJustPressed("left")) {
      this.#travel = 0;
    }
    if (this.#travel === null) {
      return;
    }

    if (mouse.isDown("left")) {
      const delta = mouse.viewportDelta(false);
      this.#travel += Math.abs(delta.x) + Math.abs(delta.y);
    }
    if (mouse.wasJustReleased("left")) {
      if (this.#travel <= kClickTravelThreshold) {
        this.#camera.pivotAt(
          this.#solid,
          mouse.viewportPositionTo(this.#pointer)
        );
      }
      this.#travel = null;
    }
  }
}
