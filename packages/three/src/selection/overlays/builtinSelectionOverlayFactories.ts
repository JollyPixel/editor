// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { SelectionOutline } from "./SelectionOutline.ts";
import { SelectionBoundingBox } from "./SelectionBoundingBox.ts";
import type { SelectionOverlayFactory } from "./SelectionOverlayFactory.ts";
import { SelectionOverlayRegistry } from "./SelectionOverlayRegistry.ts";

export const outlineOverlayFactory: SelectionOverlayFactory = {
  id: "outline",
  supports: (target) => target instanceof THREE.Mesh,
  create: (target, options) => new SelectionOutline({
    target: target as THREE.Mesh,
    color: options.color,
    opacity: options.opacity,
    linewidth: options.linewidth,
    xray: options.xray,
    dashed: options.dashed
  })
};

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

/**
 * A registry pre-populated with every built-in technique. `SelectionManager`
 * builds one per instance unless given its own.
 */
export function createDefaultSelectionOverlayRegistry(): SelectionOverlayRegistry {
  const registry = new SelectionOverlayRegistry({
    defaultId: "outline",
    fallbackId: "boundingBox"
  });
  registry.register(outlineOverlayFactory);
  registry.register(boundingBoxOverlayFactory);

  return registry;
}
