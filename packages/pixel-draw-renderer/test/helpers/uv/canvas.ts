// Import Internal Dependencies
import { LocalHistory } from "../history/LocalHistory.ts";
import type { PixelArtCanvas } from "#src/PixelArtCanvas.ts";
import {
  createPixelArtCanvas,
  type TestCanvasOptions
} from "../canvas.ts";

export function createUvCanvas(
  options: TestCanvasOptions = {}
): PixelArtCanvas {
  return createPixelArtCanvas({
    zoom: {
      default: 4
    },
    history: new LocalHistory(),
    ...options
  }).manager;
}
