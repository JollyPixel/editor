// Import Third-party Dependencies
import { ColorSequence } from "@jolly-pixel/color";

export function peerColor(
  peerId: string
): string {
  return ColorSequence.default.pick(peerId);
}
