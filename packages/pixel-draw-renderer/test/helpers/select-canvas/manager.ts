// Import Internal Dependencies
import type {
  PixelArtCanvas,
  PixelArtCanvasOptions
} from "#src/PixelArtCanvas.ts";
import { createPixelArtCanvas } from "../canvas.ts";

export function createSelectCanvas(
  options: PixelArtCanvasOptions = {}
): PixelArtCanvas {
  return createPixelArtCanvas({
    zoom: {
      default: 4
    },
    ...options
  }).manager;
}
