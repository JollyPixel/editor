// Import Third-party Dependencies
import {
  formatHex,
  parseColor,
  type RGBA
} from "@jolly-pixel/color";
import {
  detailOf,
  type JollyChangeDetail
} from "@jolly-pixel/ui";

// Import Internal Dependencies
import type { ColorChangeDetail } from "./ColorSwatch.ts";

// CONSTANTS
const kBlack: RGBA = {
  r: 0,
  g: 0,
  b: 0,
  a: 1
};

export interface ColorValueElement extends HTMLElement {
  color: string;
  opacity: number;
}

export function colorWithOpacity(
  hex: string,
  opacity: number
): RGBA {
  return {
    ...(parseColor(hex) ?? kBlack),
    a: opacity
  };
}

export function applyPickerChange(
  element: ColorValueElement,
  event: Event
): void {
  const detail = colorChangeFromPicker(event);
  if (detail === null) {
    return;
  }

  element.color = detail.hex;
  element.opacity = detail.opacity;
  element.dispatchEvent(new CustomEvent<ColorChangeDetail>("color-change", {
    bubbles: true,
    composed: true,
    detail
  }));
}

function colorChangeFromPicker(
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
