// Import Third-party Dependencies
import {
  parseColor,
  type RGBA
} from "@jolly-pixel/color";

// CONSTANTS
const kAmbiguousHex = /^#?[0-9a-f]{4}$/i;

/**
 * Parses what a user has typed into a colour field.
 *
 * Stricter than `parseColor` on one point: four digit `#rgba` is refused
 * because "#ff66" is what typing "#ff6600" looks like halfway through, and
 * committing it would silently replace the colour being typed.
 */
export function parseFieldColor(
  draft: string
): RGBA | null {
  if (kAmbiguousHex.test(draft.trim())) {
    return null;
  }

  return parseColor(draft);
}
