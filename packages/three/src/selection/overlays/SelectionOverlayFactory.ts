// Import Third-party Dependencies
import type * as THREE from "three";

// Import Internal Dependencies
import type { SelectionOverlay } from "./SelectionOverlay.ts";

export interface SelectionOverlayCreateOptions {
  color: THREE.ColorRepresentation;
  opacity: number;
  /**
   * Line width when supported.
   */
  linewidth?: number;
  /**
   * Fill opacity when supported.
   */
  fillOpacity?: number;
  xray?: boolean;
  /**
   * Dashed lines when supported.
   */
  dashed?: boolean;
}

export interface SelectionOverlayFactory {
  readonly id: string;
  supports(target: THREE.Object3D): boolean;
  create(
    target: THREE.Object3D,
    options: SelectionOverlayCreateOptions,
  ): SelectionOverlay;
}
