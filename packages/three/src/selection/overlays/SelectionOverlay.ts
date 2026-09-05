// Import Third-party Dependencies
import type * as THREE from "three";

export interface SelectionOverlay {
  color: THREE.ColorRepresentation;
  opacity: number;
  xray: boolean;
  fillOpacity?: number;
  linewidth?: number;
  update?(): void;
  dispose(): void;
}
