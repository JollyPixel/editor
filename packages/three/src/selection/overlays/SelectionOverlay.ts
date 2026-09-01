// Import Third-party Dependencies
import type * as THREE from "three";

/**
 * Common surface every per-object overlay technique (`SelectionOutline`,
 * `SelectionBoundingBox`, and any technique registered into a
 * `SelectionOverlayRegistry`) already implements - extracted so
 * `SelectionManager`/`PeerSelectionOverlays` can hold one of these without
 * knowing which concrete technique built it.
 */
export interface SelectionOverlay {
  setColor(color: THREE.ColorRepresentation): void;
  setOpacity(opacity: number): void;
  setXray(xray: boolean): void;
  /**
   * Optional - only `SelectionBoundingBox` has a fill mesh to tint at all;
   * a per-mesh technique like `SelectionOutline` has no fill concept and
   * simply doesn't implement this. A caller holding a plain `SelectionOverlay`
   * (not knowing which concrete technique built it) calls it as
   * `overlay.setFillOpacity?.(opacity)`.
   */
  setFillOpacity?(opacity: number): void;
  dispose(): void;
}
