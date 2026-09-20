// Import Third-party Dependencies
import type * as THREE from "three";

// Import Internal Dependencies
import { HANDLE_HIGHLIGHT_COLOR } from "../common/axes.ts";
import type {
  TransformCenterAppearanceOptions,
  TransformDirection,
  TransformDirectionPolicy,
  TransformGizmoAppearanceOptions,
  TransformOutlineOptions,
  TransformPlaneAppearanceOptions,
  TransformPlaneColorPolicy,
  TransformRingAppearanceOptions,
  TransformViewRingAppearanceOptions
} from "./types.ts";
import {
  finite,
  nonNegative,
  normalizedOpacity,
  positive,
  segments
} from "./validation.ts";

// CONSTANTS
export const CENTER_PICKER_SCALE = 1.25;
const kDefaultSize = 0.09;
const kDefaultGap = 0;
const kDefaultPickerRadius = 0.16;
const kDefaultPickerLengthScale = 1;
const kDefaultPickerRingTube = 0.08;
const kDefaultRenderOrder = 20;
const kDefaultOutline: ResolvedOutline = {
  color: "#080b11",
  opacity: 1,
  width: 2
};
const kDefaultCenter = {
  color: "#ffffff",
  radius: 0.1,
  radialSegments: 24
} as const;
const kDefaultPlanes = {
  size: 0.3,
  inset: 0.03,
  opacity: 0.3,
  border: 0.02,
  color: "normal"
} as const;
const kDefaultRings: ResolvedRings = {
  radius: 1,
  tube: 0.022,
  frontOnly: true,
  radialSegments: 12,
  tubularSegments: 96
};
const kDefaultViewRing: ResolvedViewRing = {
  radius: 1.25,
  color: "#e6e9ef"
};

export type ResolvedOutline = Required<TransformOutlineOptions>;
export type ResolvedRings = Required<TransformRingAppearanceOptions>;
export type ResolvedViewRing = Required<TransformViewRingAppearanceOptions>;

export interface ResolvedPlanes {
  size: number;
  inset: number;
  opacity: number;
  border: false | number;
  color: TransformPlaneColorPolicy;
}

export interface ResolvedCenter {
  color: THREE.ColorRepresentation;
  radius: number;
  radialSegments: number;
  outline: false | ResolvedOutline;
  interactive: boolean;
}

export interface ResolvedAppearance {
  size: number;
  gap: number;
  pickerRadius: number;
  pickerLengthScale: number;
  pickerRingTube: number;
  hoverColor: THREE.ColorRepresentation;
  activeColor: THREE.ColorRepresentation;
  outline: false | ResolvedOutline;
  center: false | ResolvedCenter;
  planes: false | ResolvedPlanes;
  rings: ResolvedRings;
  viewRing: false | ResolvedViewRing;
  hideAligned: boolean;
  flipTowardCamera: boolean;
  depthTest: boolean;
  renderOrder: number;
}

export function resolveAppearance(
  options: TransformGizmoAppearanceOptions
): ResolvedAppearance {
  const outline = resolveOutline(options.outline);
  const gap = nonNegative(options.gap ?? kDefaultGap, "gizmo gap");
  const center = resolveCenter(options.center, outline);

  return {
    size: positive(options.size ?? kDefaultSize, "gizmo size"),
    gap,
    pickerRadius: positive(
      options.picker?.radius ?? kDefaultPickerRadius,
      "gizmo picker.radius"
    ),
    pickerLengthScale: positive(
      options.picker?.lengthScale ?? kDefaultPickerLengthScale,
      "gizmo picker.lengthScale"
    ),
    pickerRingTube: positive(
      options.picker?.ringTube ?? kDefaultPickerRingTube,
      "gizmo picker.ringTube"
    ),
    hoverColor: options.hoverColor ?? HANDLE_HIGHLIGHT_COLOR,
    activeColor: options.activeColor ?? HANDLE_HIGHLIGHT_COLOR,
    outline,
    center,
    planes: resolvePlanes(
      options.planes,
      Math.max(gap, centerReach(center))
    ),
    rings: resolveRings(options.rings),
    viewRing: resolveViewRing(options.viewRing),
    hideAligned: options.hideAligned ?? false,
    flipTowardCamera: options.flipTowardCamera ?? false,
    depthTest: options.depthTest ?? false,
    renderOrder: finite(
      options.renderOrder ?? kDefaultRenderOrder,
      "gizmo renderOrder"
    )
  };
}

export function centerReach(
  center: false | ResolvedCenter
): number {
  if (center === false) {
    return 0;
  }

  return center.interactive
    ? center.radius * CENTER_PICKER_SCALE
    : center.radius;
}

export function resolveDirections(
  policy: TransformDirectionPolicy
): readonly TransformDirection[] {
  if (policy === "positive") {
    return [1];
  }
  if (policy === "negative") {
    return [-1];
  }

  return [1, -1];
}

function resolveOutline(
  options: false | TransformOutlineOptions | undefined
): false | ResolvedOutline {
  if (options === false) {
    return false;
  }

  return {
    color: options?.color ?? kDefaultOutline.color,
    opacity: normalizedOpacity(
      options?.opacity ?? kDefaultOutline.opacity,
      "gizmo outline.opacity"
    ),
    width: positive(
      options?.width ?? kDefaultOutline.width,
      "gizmo outline.width"
    )
  };
}

function resolveCenter(
  options: false | TransformCenterAppearanceOptions | undefined,
  outline: false | ResolvedOutline
): false | ResolvedCenter {
  if (options === undefined || options === false) {
    return false;
  }

  return {
    color: options.color ?? kDefaultCenter.color,
    radius: positive(
      options.radius ?? kDefaultCenter.radius,
      "gizmo center.radius"
    ),
    radialSegments: segments(
      options.radialSegments ?? kDefaultCenter.radialSegments,
      "gizmo center.radialSegments"
    ),
    outline: options.outline === undefined
      ? outline
      : resolveOutline(options.outline),
    interactive: options.interactive ?? false
  };
}

function resolvePlanes(
  options: false | TransformPlaneAppearanceOptions | undefined,
  hubReach: number
): false | ResolvedPlanes {
  if (options === false) {
    return false;
  }

  const border = options?.border ?? kDefaultPlanes.border;

  return {
    size: positive(
      options?.size ?? kDefaultPlanes.size,
      "gizmo planes.size"
    ),
    inset: nonNegative(
      options?.inset ?? Math.max(hubReach, kDefaultPlanes.inset),
      "gizmo planes.inset"
    ),
    opacity: normalizedOpacity(
      options?.opacity ?? kDefaultPlanes.opacity,
      "gizmo planes.opacity"
    ),
    border: border === false
      ? false
      : positive(border, "gizmo planes.border"),
    color: options?.color ?? kDefaultPlanes.color
  };
}

function resolveRings(
  options: TransformRingAppearanceOptions | undefined
): ResolvedRings {
  return {
    radius: positive(
      options?.radius ?? kDefaultRings.radius,
      "gizmo rings.radius"
    ),
    tube: positive(
      options?.tube ?? kDefaultRings.tube,
      "gizmo rings.tube"
    ),
    frontOnly: options?.frontOnly ?? kDefaultRings.frontOnly,
    radialSegments: segments(
      options?.radialSegments ?? kDefaultRings.radialSegments,
      "gizmo rings.radialSegments"
    ),
    tubularSegments: segments(
      options?.tubularSegments ?? kDefaultRings.tubularSegments,
      "gizmo rings.tubularSegments"
    )
  };
}

function resolveViewRing(
  options: false | TransformViewRingAppearanceOptions | undefined
): false | ResolvedViewRing {
  if (options === false) {
    return false;
  }

  return {
    radius: positive(
      options?.radius ?? kDefaultViewRing.radius,
      "gizmo viewRing.radius"
    ),
    color: options?.color ?? kDefaultViewRing.color
  };
}
