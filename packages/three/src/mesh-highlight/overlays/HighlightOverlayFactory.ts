// Import Third-party Dependencies
import type * as THREE from "three";

// Import Internal Dependencies
import type { HighlightOverlay } from "./HighlightOverlay.ts";

export interface HighlightOverlayCreateOptions {
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

export interface HighlightOverlayFactory {
  readonly id: string;
  supports(target: THREE.Object3D): boolean;
  create(
    target: THREE.Object3D,
    options: HighlightOverlayCreateOptions,
  ): HighlightOverlay;
}
