// Import Third-party Dependencies
import {
  formatHex,
  fromRGBA8,
  parseColor,
  toRGBA8,
  type RGBA,
  type RGBA8
} from "@jolly-pixel/color";
import type { FieldSource } from "@jolly-pixel/ui";

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

export function colorDetailOf(
  color: RGBA8
): ColorChangeDetail {
  const rgba = fromRGBA8(color);

  return {
    hex: formatHex(rgba),
    opacity: rgba.a
  };
}

export function rgba8Of(
  color: ColorChangeDetail
): RGBA8 {
  return toRGBA8(colorWithOpacity(color.hex, color.opacity));
}

export function pickerSource(
  element: ColorValueElement
): FieldSource<string> {
  return {
    read: () => formatHex(
      colorWithOpacity(element.color, element.opacity),
      true
    ),
    write: (value, last) => applyPickerChange(element, value, last)
  };
}

export function applyPickerChange(
  element: ColorValueElement,
  value: string,
  last = true
): void {
  const detail = colorChangeOf(value);
  if (detail === null) {
    return;
  }

  element.color = detail.hex;
  element.opacity = detail.opacity;
  element.dispatchEvent(new CustomEvent<ColorChangeDetail>(
    last ? "color-change" : "color-preview",
    {
      bubbles: true,
      composed: true,
      detail
    }
  ));
}

export function colorChangeOf(
  value: string
): ColorChangeDetail | null {
  const parsed = parseColor(value);
  if (parsed === null) {
    return null;
  }

  return {
    hex: formatHex(parsed),
    opacity: parsed.a
  };
}
