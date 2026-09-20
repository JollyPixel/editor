// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import {
  type Axis,
  AXIS_DIRECTION
} from "../../common/axes.ts";
import type { ResolvedPlanes } from "../appearance.ts";
import type { TransformMode } from "../types.ts";
import {
  createPlaneBorderGeometry,
  createPlaneHandleGeometry
} from "./geometry.ts";
import {
  GizmoHandle,
  type GizmoHandleStyle,
  type GizmoView
} from "./GizmoHandle.ts";
import { PLANE_AXES } from "./handleId.ts";

// CONSTANTS
const kEdgeOnThreshold = 0.2;
const kPickerScale = 1.15;
const kLayer = -1;

const kBasis = new THREE.Matrix4();
const kThird = new THREE.Vector3();

export interface PlaneHandleOptions {
  mode: TransformMode;
  normal: Axis;
  planes: ResolvedPlanes;
  color: THREE.ColorRepresentation;
  style: GizmoHandleStyle;
}

export class PlaneHandle extends GizmoHandle {
  #normal: Axis;
  #edgeOn = false;

  constructor(
    options: PlaneHandleOptions
  ) {
    const { mode, normal, planes, color, style } = options;
    const { inset, size, border } = planes;

    super({
      modes: [mode],
      id: {
        kind: "plane",
        normal
      },
      geometry: createPlaneHandleGeometry(inset, size),
      pickerGeometry: createPlaneHandleGeometry(
        inset,
        size * kPickerScale
      ),
      borderGeometry: border === false
        ? undefined
        : createPlaneBorderGeometry(inset, size, border),
      color,
      opacity: planes.opacity,
      layer: kLayer,
      side: THREE.DoubleSide,
      style: {
        ...style,
        outline: false
      }
    });

    this.#normal = normal;

    const [first, second] = PLANE_AXES[normal];
    kThird.crossVectors(AXIS_DIRECTION[first], AXIS_DIRECTION[second]);
    this.quaternion.setFromRotationMatrix(
      kBasis.makeBasis(
        AXIS_DIRECTION[first],
        AXIS_DIRECTION[second],
        kThird
      )
    );
  }

  override accepts(
    _worldPoint: THREE.Vector3
  ): boolean {
    return !this.#edgeOn;
  }

  override face(
    view: GizmoView
  ): boolean {
    this.#edgeOn = Math.abs(view.eye[this.#normal]) < kEdgeOnThreshold;
    if (view.hideAligned && this.#edgeOn) {
      return false;
    }

    const [first, second] = PLANE_AXES[this.#normal];
    const firstSign = view.flip && view.eye[first] < 0 ? -1 : 1;
    const secondSign = view.flip && view.eye[second] < 0 ? -1 : 1;
    this.scale.set(firstSign, secondSign, 1);
    this.orderByDepth(
      0.5 + (
        ((view.eye[first] * firstSign) + (view.eye[second] * secondSign)) / 4
      )
    );

    return true;
  }
}
