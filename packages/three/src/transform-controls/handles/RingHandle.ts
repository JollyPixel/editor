// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import {
  type Axis,
  AXIS_DIRECTION
} from "../../common/axes.ts";
import type { ResolvedRings } from "../appearance.ts";
import { createRingGeometry } from "./geometry.ts";
import {
  GizmoHandle,
  type GizmoHandleStyle,
  type GizmoView
} from "./GizmoHandle.ts";
import {
  createFrontClip,
  type FrontClip
} from "./materials.ts";

// CONSTANTS
const kBaseInverse = new THREE.Quaternion();
const kLocalPoint = new THREE.Vector3();

export interface RingHandleOptions {
  axis: Axis;
  rings: ResolvedRings;
  pickerTube: number;
  color: THREE.ColorRepresentation;
  style: GizmoHandleStyle;
}

export class RingHandle extends GizmoHandle {
  #clip: FrontClip | null;

  constructor(
    options: RingHandleOptions
  ) {
    const {
      axis,
      rings,
      pickerTube,
      color,
      style
    } = options;
    const clip = rings.frontOnly ? createFrontClip() : null;

    super({
      modes: ["rotate"],
      id: {
        kind: "axis",
        axis,
        direction: 1
      },
      geometry: createRingGeometry(rings.radius, rings.tube, rings),
      pickerGeometry: createRingGeometry(rings.radius, pickerTube, rings),
      color,
      clip: clip ?? undefined,
      style
    });

    this.#clip = clip;
    this.quaternion.setFromUnitVectors(
      AXIS_DIRECTION.z,
      AXIS_DIRECTION[axis]
    );
  }

  override accepts(
    worldPoint: THREE.Vector3
  ): boolean {
    if (this.#clip === null) {
      return true;
    }

    return this
      .worldToLocal(kLocalPoint.copy(worldPoint))
      .dot(this.#clip.eye.value) >= 0;
  }

  override face(
    view: GizmoView
  ): boolean {
    this.#clip?.eye.value
      .copy(view.eye)
      .applyQuaternion(kBaseInverse.copy(this.quaternion).invert());

    return true;
  }
}
