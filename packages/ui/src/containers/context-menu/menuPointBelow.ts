// Import Internal Dependencies
import type { MenuPoint } from "./MenuSession.ts";

export function menuPointBelow(
  event: MouseEvent
): MenuPoint {
  const button = event.currentTarget;
  if (!(button instanceof HTMLElement)) {
    return { x: event.clientX, y: event.clientY };
  }

  const anchor = button.getBoundingClientRect();

  return { x: anchor.left, y: anchor.bottom };
}
