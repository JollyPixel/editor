// Import Internal Dependencies
import {
  anchoredPosition,
  type AnchorRect
} from "../../geometry/anchoredPosition.ts";
import type {
  ViewportPosition,
  ViewportSize
} from "../../geometry/clampToViewport.ts";

export type SubmenuSide = "left" | "right";

export interface SubmenuPlacementOptions {
  item: AnchorRect;
  panel: ViewportSize;
  viewport: ViewportSize;
  /**
   * Menu padding, in pixels, shared by the parent and the submenu.
   */
  padding: number;
  side: SubmenuSide;
}

export interface SubmenuPlacement extends ViewportPosition {
  side: SubmenuSide;
}

export function placeSubmenu({
  item,
  panel,
  viewport,
  padding,
  side
}: SubmenuPlacementOptions): SubmenuPlacement {
  const position = anchoredPosition({
    anchor: {
      top: item.top - padding,
      bottom: item.bottom - padding,
      left: item.left,
      right: item.right
    },
    panel,
    viewport,
    gap: padding,
    side,
    align: "start"
  });
  const center = position.x + (panel.width / 2);

  return {
    ...position,
    side: center < (item.left + item.right) / 2 ? "left" : "right"
  };
}

export interface SubmenuSideOptions {
  menu: Pick<AnchorRect, "left" | "right">;
  /**
   * Width, in pixels, a submenu may take on the chosen side.
   */
  budget: number;
  viewport: ViewportSize;
  prefer: SubmenuSide;
}

export function submenuSide({
  menu,
  budget,
  viewport,
  prefer
}: SubmenuSideOptions): SubmenuSide {
  const fits = {
    left: menu.left - budget >= 0,
    right: menu.right + budget <= viewport.width
  };
  const other = prefer === "right" ? "left" : "right";

  return !fits[prefer] && fits[other] ? other : prefer;
}
