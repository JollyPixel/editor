// Import Third-party Dependencies
import { goldenAngleColor } from "@jolly-pixel/color";

/**
 * Rotates hues by the golden angle and returns a cross-renderer CSS color.
 *
 * Hex output is also accepted by Three's Color parser.
 */
export function peerColor(
  index: number
): string {
  return goldenAngleColor(index);
}
