// Import Third-party Dependencies
import type * as THREE from "three";

// CONSTANTS
const kOverlayObjects = new WeakSet<THREE.Object3D>();

export interface HighlightOverlay {
  color: THREE.ColorRepresentation;
  opacity: number;
  xray: boolean;
  fillOpacity?: number;
  linewidth?: number;
  renderOrder?: number;
  /**
   * Opacity of the portion hidden behind other geometry, when supported
   * and xray is enabled. Equal to `opacity` (no dimming) unless set lower.
   */
  occludedOpacity?: number;
  update?(cameraWorldPosition: THREE.Vector3): void;
  dispose(): void;
}

export function markHighlightOverlay(
  object: THREE.Object3D
): void {
  kOverlayObjects.add(object);
}

export function isHighlightOverlay(
  object: THREE.Object3D
): boolean {
  return kOverlayObjects.has(object);
}
