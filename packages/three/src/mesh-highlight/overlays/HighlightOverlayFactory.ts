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
  /**
   * Opacity of the portion hidden behind other geometry, when supported.
   */
  occludedOpacity?: number;
  /**
   * Whether this indicator belongs to a peer rather than the local user,
   * when supported. Techniques that render local and peer indicators with
   * overlapping geometry can use this to make the local one win.
   */
  peer?: boolean;
}

export interface HighlightOverlayFactory {
  readonly id: string;
  supports(target: THREE.Object3D): boolean;
  create(
    target: THREE.Object3D,
    options: HighlightOverlayCreateOptions,
  ): HighlightOverlay;
}
