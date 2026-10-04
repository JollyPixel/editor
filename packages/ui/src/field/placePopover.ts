// Import Internal Dependencies
import {
  anchorOrigin,
  type AnchorRect
} from "../geometry/anchoredPosition.ts";
import type {
  ViewportPosition,
  ViewportSize
} from "../geometry/clampToViewport.ts";

export type PopoverPlacement<TPosition extends ViewportPosition> = (
  panel: ViewportSize,
  viewport: ViewportSize
) => TPosition;

export function placePopover<TPosition extends ViewportPosition>(
  popover: HTMLElement,
  anchor: AnchorRect,
  place: PopoverPlacement<TPosition>
): TPosition {
  const panel = {
    width: popover.offsetWidth,
    height: popover.offsetHeight
  };
  const position = place(panel, {
    width: window.innerWidth,
    height: window.innerHeight
  });
  const origin = anchorOrigin({
    anchor,
    panel,
    position
  });

  popover.style.left = `${position.x}px`;
  popover.style.top = `${position.y}px`;
  popover.style.setProperty(
    "--jolly-overlay-origin",
    `${origin.x}px ${origin.y}px`
  );

  return position;
}
