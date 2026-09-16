// Import Third-party Dependencies
import { goldenAngleColor } from "@jolly-pixel/color";

/**
 * Golden-angle hue rotation; the hex output also parses in Three's Color.
 */
export function peerColor(
  index: number
): string {
  return goldenAngleColor(index);
}
