// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import {
  CENTER_PICKER_SCALE,
  type ResolvedCenter
} from "../appearance.ts";
import {
  GizmoHandle,
  type GizmoHandleStyle
} from "./GizmoHandle.ts";

// CONSTANTS
const kLayer = 2;

export interface CenterHandleOptions {
  center: ResolvedCenter;
  style: GizmoHandleStyle;
}

export class CenterHandle extends GizmoHandle {
  override readonly type = "TransformCenter";

  constructor(
    options: CenterHandleOptions
  ) {
    const { center, style } = options;
    const heightSegments = Math.max(
      4,
      Math.floor(center.radialSegments / 2)
    );

    super({
      modes: ["translate", "rotate", "scale"],
      id: {
        kind: "center"
      },
      geometry: new THREE.SphereGeometry(
        center.radius,
        center.radialSegments,
        heightSegments
      ),
      pickerGeometry: center.interactive
        ? new THREE.SphereGeometry(
          center.radius * CENTER_PICKER_SCALE,
          center.radialSegments,
          heightSegments
        )
        : null,
      color: center.color,
      layer: kLayer,
      style: {
        ...style,
        outline: center.outline
      }
    });
  }
}
