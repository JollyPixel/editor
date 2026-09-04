// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { SelectionOutline } from "./SelectionOutline.ts";
import { SelectionBoundingBox } from "./SelectionBoundingBox.ts";
import type { SelectionOverlayFactory } from "./SelectionOverlayFactory.ts";

/**
 * Built-in `"outline"` technique - a clean silhouette via
 * `THREE.EdgesGeometry` (see `SelectionOutline`). Only supports a
 * `THREE.Mesh`; falls back to `boundingBoxOverlayFactory` otherwise.
 */
export const outlineOverlayFactory: SelectionOverlayFactory = {
  id: "outline",
  supports: (target) => target instanceof THREE.Mesh,
  // `supports` above already guarantees a `THREE.Mesh` here - TS can't
  // express that across the two methods, hence the cast.
  create: (target, options) => new SelectionOutline({
    target: target as THREE.Mesh,
    color: options.color,
    opacity: options.opacity,
    linewidth: options.linewidth,
    xray: options.xray,
    dashed: options.dashed
  })
};

/**
 * Built-in `"boundingBox"` technique - a line-segment box (see
 * `SelectionBoundingBox`). Supports every `SelectableObject`, making it
 * eligible as the registry's `fallbackId` - in practice only resolved to
 * for a target `outline` doesn't claim (typically a `THREE.Group`).
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
