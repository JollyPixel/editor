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
  dispose(): void;
}
