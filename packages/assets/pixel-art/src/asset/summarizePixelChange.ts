// Import Third-party Dependencies
import type { PixelBuffer } from "@jolly-pixel/pixel-draw.renderer";

// CONSTANTS
const kChannels = 4;

export function summarizePixelChange(
  before: Pick<PixelBuffer, "size" | "pixels">,
  after: Pick<PixelBuffer, "size" | "pixels">
): string | null {
  const from = before.size();
  const to = after.size();
  if (from.x !== to.x || from.y !== to.y) {
    return `resized from ${from.x}×${from.y} to ${to.x}×${to.y}`;
  }

  const left = before.pixels();
  const right = after.pixels();
  let changed = 0;
  for (let offset = 0; offset < right.length; offset += kChannels) {
    if (
      left[offset] !== right[offset] ||
      left[offset + 1] !== right[offset + 1] ||
      left[offset + 2] !== right[offset + 2] ||
      left[offset + 3] !== right[offset + 3]
    ) {
      changed++;
    }
  }

  if (changed === 0) {
    return null;
  }

  return changed === 1 ? "1 pixel changed" : `${changed} pixels changed`;
}
