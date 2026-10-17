// Import Third-party Dependencies
import {
  parseColor,
  type RGBA
} from "@jolly-pixel/color";

// CONSTANTS
const kAmbiguousHex = /^#?[0-9a-f]{4}$/i;

export function parseFieldColor(
  draft: string
): RGBA | null {
  if (kAmbiguousHex.test(draft.trim())) {
    return null;
  }

  return parseColor(draft);
}
