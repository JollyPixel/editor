// Import Third-party Dependencies
import { ColorSequence } from "@jolly-pixel/color";

// CONSTANTS
const kPeerColors = ColorSequence.goldenAngle();

export function peerColor(
  index: number
): string {
  return kPeerColors.at(index);
}
