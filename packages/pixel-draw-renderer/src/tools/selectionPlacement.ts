// Import Internal Dependencies
import { clampRectPosition } from "../utils/math.ts";
import type {
  SelectionRect,
  Vec2
} from "../types.ts";

export interface SelectionPlacementOptions {
  /**
   * Texture-space cursor, or `null` when the pointer is off the texture
   * (pasting from a toolbar button, for instance).
   */
  cursor: Vec2 | null;
  /**
   * Anchor used without a cursor: the centre of what the user can see.
   */
  viewCenter: Vec2;
  /**
   * Texture size, in pixels.
   */
  bounds: Vec2;
}

/**
 * Centres incoming content on the cursor, else on the visible view, then pulls
 * it inside the texture. Content wider or taller than the texture is pinned to
 * the corresponding edge so its top-left stays visible; overflow is kept in
 * the selection and can be dragged back into range.
 */
export function placeSelection(
  size: {
    width: number;
    height: number;
  },
  options: SelectionPlacementOptions
): SelectionRect {
  const anchor = options.cursor ?? options.viewCenter;

  return clampRectPosition(
    {
      x: anchor.x - Math.floor(size.width / 2),
      y: anchor.y - Math.floor(size.height / 2),
      width: size.width,
      height: size.height
    },
    options.bounds
  );
}
