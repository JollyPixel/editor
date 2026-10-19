// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import type {
  Axis,
  AxisSign
} from "../../../common/math/axes.ts";
import { BoxVolume } from "../../BoxVolume.ts";
import type { BoxFace } from "../../faceCenter.ts";
import {
  type BoxFlipPolicy,
  type BoxResizePolicy,
  type BoxRotatePolicy,
  axisPolicyIncludes
} from "../../types.ts";
import { BoxFlipHandles } from "./BoxFlipHandles.ts";
import { BoxHandles } from "./BoxHandles.ts";
import { BoxRotateDial } from "./BoxRotateDial.ts";
import { BoxRotateHandle } from "./BoxRotateHandle.ts";
import {
  BoxView,
  type BoxViewOptions
} from "./BoxView.ts";

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

export class BoxHandleSet extends THREE.Object3D {
  #view: BoxView;
  #resize: BoxHandles;
  #rotate: BoxRotateHandle;
  #dial: BoxRotateDial;
  #flip: BoxFlipHandles;
  #rotateAxes: BoxRotatePolicy = "none";
  #rotating = false;

  constructor(
    options: BoxViewOptions
  ) {
    super();

    this.#view = new BoxView(options);
    this.#resize = new BoxHandles();
    this.#rotate = new BoxRotateHandle();
    this.#dial = new BoxRotateDial();
    this.#flip = new BoxFlipHandles();
    this.add(this.#resize, this.#rotate, this.#dial, this.#flip);
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
    box.add(this);
  }

  detachFrom(
    box: BoxVolume
  ): void {
    box.remove(this);
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

  override updateMatrixWorld(
    force?: boolean
  ): void {
    const parent = this.parent;
    if (parent instanceof BoxVolume) {
      this.#view.update(parent);
      this.#resize.face(this.#view);
      this.#rotate.face(this.#view);
      this.#dial.face(this.#view);
      this.#flip.face(this.#view);
    }

    super.updateMatrixWorld(force);
  }

  override dispose(): void {
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
