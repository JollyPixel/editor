// Import Internal Dependencies
import { LocalHistory } from "../history/LocalHistory.ts";
import type { PixelArtCanvas } from "#src/PixelArtCanvas.ts";
import {
  createPixelArtCanvas,
  type TestCanvasOptions
} from "../canvas.ts";
import { mouseEvent } from "../events.ts";

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

export function drag(
  manager: PixelArtCanvas,
  from: { x: number; y: number; },
  to: { x: number; y: number; }
): void {
  const canvas = manager.canvas();
  canvas.dispatchEvent(mouseEvent("mousemove", from.x, from.y));
  canvas.dispatchEvent(mouseEvent("mousedown", from.x, from.y));
  canvas.dispatchEvent(mouseEvent("mousemove", to.x, to.y));
  canvas.dispatchEvent(mouseEvent("mouseup", to.x, to.y));
}
