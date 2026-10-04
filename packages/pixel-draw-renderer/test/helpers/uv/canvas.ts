// Import Internal Dependencies
import type {
  PixelArtCanvas,
  PixelArtCanvasOptions
} from "#src/PixelArtCanvas.ts";
import { createPixelArtCanvas } from "../canvas.ts";

export function createUvCanvas(
  options: PixelArtCanvasOptions = {}
): PixelArtCanvas {
  return createPixelArtCanvas({
    zoom: {
      default: 4
    },
    history: {
      enabled: true
    },
    ...options
  }).manager;
}
