// Import Third-party Dependencies
import {
  formatHex,
  parseColor
} from "@jolly-pixel/color";
import {
  detailOf,
  type JollyChangeDetail
} from "@jolly-pixel/ui";

// Import Internal Dependencies
import type { ColorChangeDetail } from "./ColorSwatch.ts";

export function colorChangeFromPicker(
  event: Event
): ColorChangeDetail | null {
  const detail = detailOf<JollyChangeDetail<string>>(event);
  if (detail === null) {
    return null;
  }

  const parsed = parseColor(detail.value);
  if (parsed === null) {
    return null;
  }

  return {
    hex: formatHex(parsed),
    opacity: parsed.a
  };
}
