// Import Internal Dependencies
import type {
  ResolvedRings,
  ResolvedViewRing
} from "../appearance.ts";
import { createRingGeometry } from "./geometry.ts";
import {
  GizmoHandle,
  type GizmoHandleStyle,
  type GizmoView
} from "./GizmoHandle.ts";

export interface ViewRingHandleOptions {
  viewRing: ResolvedViewRing;
  rings: ResolvedRings;
  pickerTube: number;
  style: GizmoHandleStyle;
}

export class ViewRingHandle extends GizmoHandle {
  constructor(
    options: ViewRingHandleOptions
  ) {
    const {
      viewRing,
      rings,
      pickerTube,
      style
    } = options;

    super({
      modes: ["rotate"],
      id: {
        kind: "view"
      },
      geometry: createRingGeometry(viewRing.radius, rings.tube, rings),
      pickerGeometry: createRingGeometry(
        viewRing.radius,
        pickerTube,
        rings
      ),
      color: viewRing.color,
      style
    });
  }

  override face(
    view: GizmoView
  ): boolean {
    this.quaternion.copy(view.cameraQuaternion);

    return true;
  }
}
