// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { SelectionOutline } from "./SelectionOutline.ts";
import { SelectionBoundingBox } from "./SelectionBoundingBox.ts";
import type { SelectionOverlayFactory } from "./SelectionOverlayFactory.ts";

/**
 * Built-in `"outline"` technique - a clean silhouette via `THREE.EdgesGeometry`
 * (see `SelectionOutline`'s own doc comment). Only supports a `THREE.Mesh`
 * target; `SelectionOverlayRegistry` falls back to `boundingBoxOverlayFactory`
 * for anything else.
 */
export const outlineOverlayFactory: SelectionOverlayFactory = {
  id: "outline",
  supports: (target) => target instanceof THREE.Mesh,
  // `supports` above already guarantees `target` is a `THREE.Mesh` by the
  // time `SelectionOverlayRegistry.resolve` ever calls `create` with it - TS
  // can't express that dependency across the two methods of this object
  // literal, hence the cast.
  create: (target, options) => new SelectionOutline({
    target: target as THREE.Mesh,
    color: options.color,
    opacity: options.opacity,
    linewidth: options.linewidth,
    xray: options.xray
  })
};

/**
 * Built-in `"boundingBox"` technique - a line-segment box (see
 * `SelectionBoundingBox`'s own doc comment). Supports every
 * `SelectableObject` unconditionally, which is what makes it eligible as a
 * `SelectionOverlayRegistry`'s `fallbackId` - in practice it's only ever
 * actually resolved to for a target no other registered technique supports
 * (typically a `THREE.Group`), since `outline` already claims every
 * `THREE.Mesh` first.
 */
export const boundingBoxOverlayFactory: SelectionOverlayFactory = {
  id: "boundingBox",
  supports: () => true,
  create: (target, options) => new SelectionBoundingBox({
    target,
    color: options.color,
    opacity: options.opacity,
    xray: options.xray,
    fillOpacity: options.fillOpacity
  })
};
