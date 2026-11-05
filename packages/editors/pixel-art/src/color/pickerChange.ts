// Import Third-party Dependencies
import {
  Color,
  type RGBA8
} from "@jolly-pixel/color";
import type { FieldSource } from "@jolly-pixel/ui";

// Import Internal Dependencies
import type { ColorChangeDetail } from "./ColorSwatch.ts";

export interface ColorValueElement extends HTMLElement {
  color: string;
  opacity: number;
}

export function colorWithOpacity(
  hex: string,
  opacity: number
): Color {
  return (Color.parse(hex) ?? Color.black).withAlpha(opacity);
}

export function rgba8ToColorChange(
  color: RGBA8
): ColorChangeDetail {
  const unit = Color.fromBytes(color);

  return {
    hex: unit.hex(),
    opacity: unit.a
  };
}

export function colorChangeToRgba8(
  color: ColorChangeDetail
): RGBA8 {
  return colorWithOpacity(color.hex, color.opacity).toBytes();
}

export function pickerSource(
  element: ColorValueElement
): FieldSource<string> {
  return {
    read: () => colorWithOpacity(element.color, element.opacity).hex(true),
    write: (value, last) => applyPickerChange(element, value, last)
  };
}

export function applyPickerChange(
  element: ColorValueElement,
  value: string,
  last = true
): void {
  const detail = parseColorChange(value);
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

export function parseColorChange(
  value: string
): ColorChangeDetail | null {
  const parsed = Color.parse(value);
  if (parsed === null) {
    return null;
  }

  return {
    hex: parsed.hex(),
    opacity: parsed.a
  };
}
