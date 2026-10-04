// Import Internal Dependencies
import type { PixelArtCanvas } from "#src/PixelArtCanvas.ts";
import {
  createPixelArtCanvas,
  type TestCanvasOptions
} from "../canvas.ts";

export function createSelectCanvas(
  options: TestCanvasOptions = {}
): PixelArtCanvas {
  return createPixelArtCanvas({
    zoom: {
      default: 4
    },
    ...options
  }).manager;
}
