// Import Internal Dependencies
import { SelectionOverlayRegistry, type SelectionOverlayCreateOptions } from "./SelectionOverlayFactory.ts";
import {
  outlineOverlayFactory,
  boundingBoxOverlayFactory
} from "./builtinSelectionOverlayFactories.ts";
import type { SelectionOverlay } from "./SelectionOverlay.ts";
import type { SelectionTechnique, SelectableObject } from "../SelectionManager.ts";

export type { SelectionOverlay } from "./SelectionOverlay.ts";
export type {
  SelectionOverlayFactory,
  SelectionOverlayCreateOptions,
  SelectionOverlayRegistryOptions
} from "./SelectionOverlayFactory.ts";
export { SelectionOverlayRegistry } from "./SelectionOverlayFactory.ts";
export {
  outlineOverlayFactory,
  boundingBoxOverlayFactory
};

export interface CreateSelectionOverlayOptions extends SelectionOverlayCreateOptions {
  technique: SelectionTechnique;
}

/**
 * The registry `createSelectionOverlay` resolves against, pre-populated
 * with the built-in `outline`/`boundingBox` techniques. `.register()`
 * further factories here (or build a separate `SelectionOverlayRegistry`)
 * to add more. See `SelectionOverlayRegistry` for resolution order.
 */
export const defaultSelectionOverlayRegistry = new SelectionOverlayRegistry({
  defaultId: "outline",
  fallbackId: "boundingBox"
});
defaultSelectionOverlayRegistry.register(outlineOverlayFactory);
defaultSelectionOverlayRegistry.register(boundingBoxOverlayFactory);

/**
 * Picks and builds the right overlay for `target` via
 * `defaultSelectionOverlayRegistry`. Extracted out of `SelectionManager` so
 * `PeerSelectionOverlays` can build matching overlays for remote peer
 * selections without duplicating this resolution.
 */
export function createSelectionOverlay(
  target: SelectableObject,
  options: CreateSelectionOverlayOptions
): SelectionOverlay {
  const { technique, ...createOptions } = options;

  return defaultSelectionOverlayRegistry.resolve(technique, target).create(target, createOptions);
}
