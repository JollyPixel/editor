// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import {
  type Axis,
  type AxisSign,
  AXIS_DIRECTION
} from "../../../common/math/axes.ts";
import {
  type BoxFace,
  faceCenter
} from "../../faceCenter.ts";
import type { AxisConstraints } from "./AxisConstraints.ts";
import { closestPointOnAxis } from "./projection.ts";
import { resizeAxis } from "./snapping.ts";

// CONSTANTS
const kAxisOrigin = new THREE.Vector3();
const kPoint = new THREE.Vector3();

export interface ResizeDragStep {
  ray: THREE.Ray;
  free: boolean;
  constraints: AxisConstraints;
}

export class ResizeDrag {
  readonly axis: Axis;
  readonly sign: AxisSign;

  #faceOffset: number;

  static begin(
    ray: THREE.Ray,
    min: THREE.Vector3,
    size: THREE.Vector3,
    face: BoxFace
  ): ResizeDrag | null {
    if (!projectOnFaceAxis(ray, min, size, face)) {
      return null;
    }

    return new ResizeDrag(face, kPoint[face.axis] - kAxisOrigin[face.axis]);
  }

  constructor(
    face: BoxFace,
    faceOffset: number
  ) {
    this.axis = face.axis;
    this.sign = face.sign;
    this.#faceOffset = faceOffset;
  }

  update(
    step: ResizeDragStep,
    min: THREE.Vector3,
    size: THREE.Vector3
  ): void {
    if (!projectOnFaceAxis(step.ray, min, size, this)) {
      return;
    }

    const { axis, sign } = this;
    const { constraints } = step;
    const extent = resizeAxis({
      min: min[axis],
      size: size[axis],
      sign,
      faceCoord: constraints.snapOn(
        axis,
        kPoint[axis] - this.#faceOffset,
        step.free
      ),
      minSize: constraints.axisMinSize(axis),
      bounds: constraints.axisRange(axis)
    });
    min[axis] = extent.min;
    size[axis] = extent.size;
  }
}

function projectOnFaceAxis(
  ray: THREE.Ray,
  min: THREE.Vector3,
  size: THREE.Vector3,
  face: BoxFace
): boolean {
  faceCenter(min, size, face, kAxisOrigin);

  return closestPointOnAxis(ray, kAxisOrigin, AXIS_DIRECTION[face.axis], kPoint);
}
