// Import Third-party Dependencies
import type { PixelArtCanvas } from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import type { ColorChangeDetail } from "./ColorSwatch.ts";

export type BrushColor = PixelArtCanvas["brush"]["primary"];

export function readBrushColor(
  color: BrushColor
): ColorChangeDetail {
  return {
    hex: color.asString("hex"),
    opacity: color.opacity
  };
}

export function writeBrushColor(
  color: BrushColor,
  value: ColorChangeDetail
): void {
  color.set(value.hex, value.opacity);
}
