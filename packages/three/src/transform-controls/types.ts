// Import Third-party Dependencies
import type * as THREE from "three";

// Import Internal Dependencies
import type {
  Axis,
  AxisSign
} from "../common/axes.ts";
import type { SnapStep } from "../common/snap.ts";

export type TransformAxis = Axis;
export type TransformDirection = AxisSign;
export type TransformDirectionPolicy = "positive" | "negative" | "both";
export type TransformMode = "translate" | "rotate" | "scale";
export type TransformPlaneColorPolicy = "normal" | "blend";
export type TransformOrientation =
  | "world"
  | "local"
  | "parent"
  | "view"
  | THREE.QuaternionLike;
export type TransformPivot =
  | "origin"
  | THREE.Object3D
  | THREE.Vector3Like;

export type TransformHandle =
  | {
    kind: "axis";
    axis: TransformAxis;
    direction: TransformDirection;
  }
  | {
    kind: "plane";
    normal: TransformAxis;
  }
  | {
    kind: "center";
  }
  | {
    kind: "view";
  };

export interface TransformArrowHandleOptions {
  kind: "arrow";
  shaftLength?: number;
  shaftRadius?: number;
  headLength?: number;
  headRadius?: number;
  radialSegments?: number;
}

export interface TransformSphereHandleOptions {
  kind: "sphere";
  shaftLength?: number;
  shaftRadius?: number;
  radius?: number;
  radialSegments?: number;
}

export interface TransformCubeHandleOptions {
  kind: "cube";
  shaftLength?: number;
  shaftRadius?: number;
  /**
   * Edge length of the cube tip, in gizmo units.
   */
  size?: number;
  radialSegments?: number;
}

export type TransformAxisHandleOptions =
  | TransformArrowHandleOptions
  | TransformSphereHandleOptions
  | TransformCubeHandleOptions;

export interface TransformAxisAppearanceOptions {
  color?: THREE.ColorRepresentation;
  directions?: TransformDirectionPolicy;
  /**
   * Translate handle shape for this axis.
   */
  handle?: TransformAxisHandleOptions;
  /**
   * Scale handle shape for this axis.
   */
  scaleHandle?: TransformAxisHandleOptions;
}

export type TransformAxisAppearance =
  | false
  | TransformAxisAppearanceOptions;

export interface TransformAxesAppearanceOptions {
  x?: TransformAxisAppearance;
  y?: TransformAxisAppearance;
  z?: TransformAxisAppearance;
}

export interface TransformOutlineOptions {
  color?: THREE.ColorRepresentation;
  opacity?: number;
  /**
   * Outline width in CSS pixels, constant under any view angle.
   */
  width?: number;
}

export interface TransformPickerOptions {
  /**
   * Radius of the invisible axis picker, in gizmo units.
   */
  radius?: number;
  /**
   * Axis picker length relative to the handle length.
   */
  lengthScale?: number;
  /**
   * Tube radius of the invisible ring picker, in gizmo units.
   */
  ringTube?: number;
}

export interface TransformCenterAppearanceOptions {
  color?: THREE.ColorRepresentation;
  radius?: number;
  radialSegments?: number;
  outline?: false | TransformOutlineOptions;
  /**
   * When true the center moves on the view plane in translate mode and
   * scales uniformly in scale mode. Defaults to a visual-only marker.
   */
  interactive?: boolean;
}

export interface TransformPlaneAppearanceOptions {
  /**
   * Edge length of each plane handle, in gizmo units.
   */
  size?: number;
  /**
   * Distance between both in-plane axes and the inner edges of the
   * handle, in gizmo units. Defaults to the larger of the gizmo gap, the
   * center handle reach and the axis shaft radius, so the inner corner
   * rests against the hub.
   */
  inset?: number;
  /**
   * Fill opacity. The border stays opaque.
   */
  opacity?: number;
  /**
   * Thickness of the opaque border drawn on the two outer edges, in
   * gizmo units. Defaults to 0.02; false omits the border.
   */
  border?: false | number;
  /**
   * "normal" paints a handle with the color of its normal axis, "blend"
   * with the mix of its two in-plane axis colors. Defaults to "normal".
   */
  color?: TransformPlaneColorPolicy;
}

export interface TransformRingAppearanceOptions {
  radius?: number;
  tube?: number;
  /**
   * Draw only the camera-facing half of each ring, closed by a
   * silhouette circle. Defaults to true; false draws full rings.
   */
  frontOnly?: boolean;
  radialSegments?: number;
  tubularSegments?: number;
}

export interface TransformViewRingAppearanceOptions {
  radius?: number;
  color?: THREE.ColorRepresentation;
}

export interface TransformGizmoAppearanceOptions {
  /**
   * Gizmo size as a fraction of the camera scale.
   */
  size?: number;
  /**
   * Empty distance between the origin and each axis handle.
   */
  gap?: number;
  directions?: TransformDirectionPolicy;
  /**
   * Shared translate handle shape. Defaults to an arrow.
   */
  handle?: TransformAxisHandleOptions;
  /**
   * Shared scale handle shape. Defaults to a cube tip.
   */
  scaleHandle?: TransformAxisHandleOptions;
  axes?: TransformAxesAppearanceOptions;
  center?: false | TransformCenterAppearanceOptions;
  /**
   * Two-axis handles of the translate and scale modes.
   */
  planes?: false | TransformPlaneAppearanceOptions;
  rings?: TransformRingAppearanceOptions;
  /**
   * Screen-facing ring of the rotate mode.
   */
  viewRing?: false | TransformViewRingAppearanceOptions;
  outline?: false | TransformOutlineOptions;
  picker?: TransformPickerOptions;
  hoverColor?: THREE.ColorRepresentation;
  activeColor?: THREE.ColorRepresentation;
  /**
   * Hide axis and plane handles that are too aligned with the view to
   * be dragged reliably. Defaults to false.
   */
  hideAligned?: boolean;
  /**
   * Point single-direction axis handles and plane handles toward the
   * camera. Defaults to false.
   */
  flipTowardCamera?: boolean;
  depthTest?: boolean;
  renderOrder?: number;
}

export interface TransformSnapOptions {
  /**
   * World-unit step, shared or per gizmo axis. Applies to the distance
   * travelled from the gesture start.
   */
  translate?: SnapStep;
  /**
   * Angle step in radians.
   */
  rotate?: number | null;
  /**
   * Step applied to the resulting scale values.
   */
  scale?: number | null;
}

export interface TransformAxesPolicy {
  x?: boolean;
  y?: boolean;
  z?: boolean;
}

export interface TransformControlsOptions {
  mode?: TransformMode;
  /**
   * Orientation of the gizmo axes. Scale gestures always use `"local"`.
   */
  orientation?: TransformOrientation;
  /**
   * Gizmo origin and center of rotation and scaling. A vector is a
   * point in the target's local space; an object is followed in world
   * space. Defaults to `"origin"`, the target's own position.
   */
  pivot?: TransformPivot;
  snap?: TransformSnapOptions;
  /**
   * Axes open to interaction. Disabled axes hide every handle that
   * involves them.
   */
  axes?: TransformAxesPolicy;
  /**
   * Translation clamp volume in the target parent's space.
   */
  limits?: THREE.Box3 | null;
  appearance?: TransformGizmoAppearanceOptions;
}

export interface TransformGestureEvent {
  mode: TransformMode;
  handle: TransformHandle;
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  scale: THREE.Vector3;
  worldPosition: THREE.Vector3;
}

export interface TransformChangeEvent extends TransformGestureEvent {
  changed: true;
}

export interface TransformEndEvent extends TransformGestureEvent {
  changed: boolean;
  cancelled: boolean;
}

export interface TransformControlsEventMap {
  start: TransformGestureEvent;
  change: TransformChangeEvent;
  end: TransformEndEvent;
}
