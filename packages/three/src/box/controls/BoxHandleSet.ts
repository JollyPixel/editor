// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import type {
  Axis,
  AxisSign
} from "../../common/axes.ts";
import type { BoxVolume } from "../BoxVolume.ts";
import type { BoxFace } from "../faceCenter.ts";
import {
  type BoxFlipPolicy,
  type BoxResizePolicy,
  type BoxRotatePolicy,
  axisPolicyIncludes
} from "../types.ts";
import { BoxFlipHandles } from "./BoxFlipHandles.ts";
import { BoxHandles } from "./BoxHandles.ts";
import {
  BoxRotateDial,
  type PivotResolver
} from "./BoxRotateDial.ts";
import { BoxRotateHandle } from "./BoxRotateHandle.ts";

export type BoxHandlePick =
  | {
    kind: "resize";
    face: BoxFace;
  }
  | {
    kind: "rotate";
    direction: AxisSign;
  }
  | {
    kind: "flip";
    axis: Axis;
  };

export interface BoxHandleSetOptions {
  camera: THREE.Camera;
  handleSize: number;
  pivot: PivotResolver;
}

export class BoxHandleSet {
  #resize: BoxHandles;
  #rotate: BoxRotateHandle;
  #dial: BoxRotateDial;
  #flip: BoxFlipHandles;
  #rotateAxes: BoxRotatePolicy = "none";
  #rotating = false;

  constructor(
    options: BoxHandleSetOptions
  ) {
    const { camera, handleSize, pivot } = options;

    this.#resize = new BoxHandles({
      camera,
      handleSize
    });
    this.#rotate = new BoxRotateHandle({
      camera,
      handleSize
    });
    this.#dial = new BoxRotateDial({
      camera,
      handleSize,
      pivot
    });
    this.#flip = new BoxFlipHandles({
      camera,
      handleSize
    });
    this.rotateAxes = "none";
  }

  get resizeAxes(): BoxResizePolicy {
    return this.#resize.resizeAxes;
  }

  set resizeAxes(
    policy: BoxResizePolicy
  ) {
    this.#resize.resizeAxes = policy;
    this.#flip.resizeAxes = policy;
  }

  get rotateAxes(): BoxRotatePolicy {
    return this.#rotateAxes;
  }

  set rotateAxes(
    policy: BoxRotatePolicy
  ) {
    this.#rotateAxes = policy;
    this.#rotate.visible = policy === "y" && !this.#rotating;
  }

  get flipAxes(): BoxFlipPolicy {
    return this.#flip.flipAxes;
  }

  set flipAxes(
    policy: BoxFlipPolicy
  ) {
    this.#flip.flipAxes = policy;
  }

  copyCornerTo(
    box: BoxVolume,
    target: THREE.Vector3
  ): THREE.Vector3 {
    return target.copy(this.#rotate.position).add(box.position);
  }

  attachTo(
    box: BoxVolume
  ): void {
    box.add(this.#resize, this.#rotate, this.#dial, this.#flip);
  }

  detachFrom(
    box: BoxVolume
  ): void {
    box.remove(this.#resize, this.#rotate, this.#dial, this.#flip);
    this.hover(null);
  }

  pick(
    raycaster: THREE.Raycaster
  ): BoxHandlePick | null {
    const pickers = [...this.#resize.pickers];
    if (this.#rotateAxes === "y") {
      pickers.push(...this.#rotate.pickers);
    }
    pickers.push(...this.#flip.pickers);

    const [hit] = raycaster.intersectObjects(pickers, false);

    return hit === undefined ? null : this.#resolve(hit);
  }

  hover(
    pick: BoxHandlePick | null
  ): void {
    this.#resize.hover(pick?.kind === "resize" ? pick.face : null);
    this.#rotate.hover(pick?.kind === "rotate" ? pick.direction : null);
    this.#flip.hover(pick?.kind === "flip" ? pick.axis : null);
    if (pick?.kind === "rotate") {
      this.#dial.showPivot();
    }
    else {
      this.#dial.hide();
    }
  }

  beginRotate(
    corner: THREE.Vector3Like
  ): void {
    this.#rotating = true;
    this.#rotate.visible = false;
    this.#rotate.hover(null);
    this.#dial.beginSweep(corner);
  }

  sweepTo(
    angle: number
  ): void {
    this.#dial.sweepTo(angle);
  }

  previewFlip(
    axis: Axis | null
  ): void {
    this.#flip.hover(axis);
  }

  endGesture(): void {
    this.#rotating = false;
    this.#rotate.visible = this.#rotateAxes === "y";
    this.#dial.hide();
    this.#flip.hover(null);
  }

  dispose(): void {
    this.#resize.dispose();
    this.#rotate.dispose();
    this.#dial.dispose();
    this.#flip.dispose();
  }

  #resolve(
    hit: THREE.Intersection
  ): BoxHandlePick | null {
    const face = this.#resize.resolve(hit);
    if (face !== null) {
      return axisPolicyIncludes(this.resizeAxes, face.axis)
        ? {
          kind: "resize",
          face
        }
        : null;
    }

    const direction = this.#rotate.resolve(hit);
    if (direction !== null) {
      return {
        kind: "rotate",
        direction
      };
    }

    const axis = this.#flip.resolve(hit);

    return axis === null ? null : {
      kind: "flip",
      axis
    };
  }
}
