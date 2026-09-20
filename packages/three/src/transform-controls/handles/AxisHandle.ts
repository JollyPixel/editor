// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import {
  type Axis,
  type AxisSign,
  AXIS_DIRECTION
} from "../../common/axes.ts";
import type { TransformMode } from "../types.ts";
import type { AxisHandleGeometry } from "./geometry.ts";
import {
  GizmoHandle,
  type GizmoHandleStyle,
  type GizmoView
} from "./GizmoHandle.ts";

// CONSTANTS
const kAlignedThreshold = 0.99;
const kPickerSegments = 6;

const kDirection = new THREE.Vector3();

export interface AxisHandleOptions {
  mode: TransformMode;
  axis: Axis;
  direction: AxisSign;
  flippable: boolean;
  gap: number;
  shape: AxisHandleGeometry;
  color: THREE.ColorRepresentation;
  pickerRadius: number;
  pickerLengthScale: number;
  style: GizmoHandleStyle;
}

export class AxisHandle extends GizmoHandle {
  #axis: Axis;
  #direction: AxisSign;
  #flippable: boolean;
  #gap: number;
  #placed: number | null = null;

  constructor(
    options: AxisHandleOptions
  ) {
    const {
      mode,
      axis,
      direction,
      flippable,
      gap,
      shape,
      color,
      pickerRadius,
      pickerLengthScale,
      style
    } = options;
    const pickerLength = shape.length * pickerLengthScale;

    super({
      modes: [mode],
      id: {
        kind: "axis",
        axis,
        direction
      },
      geometry: shape.geometry,
      pickerGeometry: new THREE.CylinderGeometry(
        pickerRadius,
        pickerRadius,
        pickerLength,
        kPickerSegments
      ).translate(0, pickerLength / 2, 0),
      color,
      style
    });

    this.#axis = axis;
    this.#direction = direction;
    this.#flippable = flippable;
    this.#gap = gap;
    this.#place(direction);
  }

  override face(
    view: GizmoView
  ): boolean {
    const along = view.eye[this.#axis];
    if (view.hideAligned && Math.abs(along) > kAlignedThreshold) {
      return false;
    }

    const away = along * this.#direction < 0;
    const sign = view.flip && this.#flippable && away
      ? -this.#direction
      : this.#direction;
    this.#place(sign);
    this.orderByDepth(0.5 + (along * sign * 0.5));

    return true;
  }

  #place(
    sign: number
  ): void {
    if (sign === this.#placed) {
      return;
    }

    this.#placed = sign;
    kDirection
      .copy(AXIS_DIRECTION[this.#axis])
      .multiplyScalar(sign);
    this.position
      .copy(kDirection)
      .multiplyScalar(this.#gap);
    this.quaternion.setFromUnitVectors(
      AXIS_DIRECTION.y,
      kDirection
    );
  }
}
