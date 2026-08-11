// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { SelectionOutline } from "./SelectionOutline.ts";
import { SelectionHighlight } from "./SelectionHighlight.ts";
import { SelectionBoundingBox } from "./SelectionBoundingBox.ts";
import type { MeshSelectionStyle, SelectableObject } from "./SelectionManager.ts";

export type SelectionOverlay = SelectionOutline | SelectionHighlight | SelectionBoundingBox;

export interface CreateSelectionOverlayOptions {
  style: MeshSelectionStyle;
  color: THREE.ColorRepresentation;
  opacity: number;
  /**
   * Forwarded to `SelectionOutline` when `style` is `"outline"` - ignored
   * otherwise (and for a non-mesh `target`, which always gets a
   * `SelectionBoundingBox`).
   */
  linewidth?: number;
  /**
   * Forwarded to `SelectionHighlight` when `style` is `"highlight"` -
   * ignored otherwise.
   */
  thickness?: number;
  /**
   * Forwarded to whichever overlay gets built - `SelectionOutline`,
   * `SelectionHighlight`, or `SelectionBoundingBox` - so a selection stays
   * visible through occluding geometry regardless of `style` or of `target`
   * being a mesh vs. a group.
   */
  xray?: boolean;
}

/**
 * Picks and builds the right overlay for `target`: a non-mesh target (e.g. a
 * `THREE.Group`) always gets a `SelectionBoundingBox`; a `THREE.Mesh` gets a
 * `SelectionOutline` or `SelectionHighlight` per `options.style`.
 *
 * Extracted out of `SelectionManager` so `PeerSelectionOverlays` can build
 * the exact same overlays for remote peer selections without duplicating
 * this branching.
 */
export function createSelectionOverlay(
  target: SelectableObject,
  options: CreateSelectionOverlayOptions
): SelectionOverlay {
  const { style, color, opacity, linewidth, thickness, xray } = options;

  if (!(target instanceof THREE.Mesh)) {
    return new SelectionBoundingBox({ target, color, opacity, xray });
  }

  return style === "highlight" ?
    new SelectionHighlight({ target, color, opacity, thickness, xray }) :
    new SelectionOutline({ target, color, opacity, linewidth, xray });
}
