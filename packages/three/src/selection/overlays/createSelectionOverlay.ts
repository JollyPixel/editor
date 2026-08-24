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
 * The registry `createSelectionOverlay` resolves against. Pre-populated with
 * every built-in technique (`outline`/`boundingBox`) - a caller wanting a
 * different or additional per-object technique (e.g. another editor in this
 * monorepo) can `.register()` its own `SelectionOverlayFactory` into this
 * same registry instead of forking `createSelectionOverlay`, or build a
 * wholly separate `SelectionOverlayRegistry` and resolve against that
 * directly. See `SelectionOverlayRegistry`'s own doc comment for the
 * resolution order.
 */
export const defaultSelectionOverlayRegistry = new SelectionOverlayRegistry({
  defaultId: "outline",
  fallbackId: "boundingBox"
});
defaultSelectionOverlayRegistry.register(outlineOverlayFactory);
defaultSelectionOverlayRegistry.register(boundingBoxOverlayFactory);

/**
 * Picks and builds the right overlay for `target` via
 * `defaultSelectionOverlayRegistry`: a non-mesh target (e.g. a `THREE.Group`)
 * always falls back to the `"boundingBox"` technique; a `THREE.Mesh` resolves
 * per `options.technique`.
 *
 * Extracted out of `SelectionManager` so `PeerSelectionOverlays` can build
 * the exact same overlays for remote peer selections without duplicating
 * this resolution.
 */
export function createSelectionOverlay(
  target: SelectableObject,
  options: CreateSelectionOverlayOptions
): SelectionOverlay {
  const { technique, ...createOptions } = options;

  return defaultSelectionOverlayRegistry.resolve(technique, target).create(target, createOptions);
}
