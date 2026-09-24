// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { HighlightOutline } from "./HighlightOutline.ts";
import { HighlightBoundingBox } from "./HighlightBoundingBox.ts";
import { HighlightBoxSilhouette } from "./HighlightBoxSilhouette.ts";
import type { HighlightOverlayFactory } from "./HighlightOverlayFactory.ts";
import { HighlightOverlayRegistry } from "./HighlightOverlayRegistry.ts";

export const outlineOverlayFactory: HighlightOverlayFactory = {
  id: "outline",
  supports: (target) => target instanceof THREE.Mesh,
  create: (target, options) => new HighlightOutline({
    target: target as THREE.Mesh,
    color: options.color,
    opacity: options.opacity,
    linewidth: options.linewidth,
    xray: options.xray,
    dashed: options.dashed
  })
};

export const boxSilhouetteOverlayFactory: HighlightOverlayFactory = {
  id: "boxSilhouette",
  supports: (target) => target instanceof THREE.Mesh && target.geometry instanceof THREE.BoxGeometry,
  create: (target, options) => new HighlightBoxSilhouette({
    target: target as THREE.Mesh,
    color: options.color,
    opacity: options.opacity,
    linewidth: options.linewidth,
    xray: options.xray,
    occludedOpacity: options.occludedOpacity,
    peer: options.peer,
    renderOrder: options.renderOrder === undefined || !options.peer ?
      options.renderOrder :
      options.renderOrder - 1,
    xrayDepthWrite: options.xrayDepthWrite
  })
};

export const boundingBoxOverlayFactory: HighlightOverlayFactory = {
  id: "boundingBox",
  supports: () => true,
  create: (target, options) => new HighlightBoundingBox({
    target,
    color: options.color,
    opacity: options.opacity,
    xray: options.xray,
    fillOpacity: options.fillOpacity
  })
};

/**
 * A registry pre-populated with every built-in technique. `MeshHighlightState`
 * builds one per instance unless given its own.
 */
export function createDefaultHighlightOverlayRegistry(): HighlightOverlayRegistry {
  const registry = new HighlightOverlayRegistry({
    defaultId: "outline",
    fallbackId: "boundingBox"
  });
  registry.register(outlineOverlayFactory);
  registry.register(boundingBoxOverlayFactory);
  registry.register(boxSilhouetteOverlayFactory);

  return registry;
}
