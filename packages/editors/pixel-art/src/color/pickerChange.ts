// Import Third-party Dependencies
import {
  formatHex,
  parseColor,
  type RGBA
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

export function pickerSource(
  element: ColorValueElement
): FieldSource<string> {
  return {
    read: () => formatHex(
      colorWithOpacity(element.color, element.opacity),
      true
    ),
    write: (value) => applyPickerChange(element, value)
  };
}

export function applyPickerChange(
  element: ColorValueElement,
  value: string
): void {
  const detail = colorChangeOf(value);
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
