// Import Internal Dependencies
import type {
  PixelArtCanvas
} from "#src/PixelArtCanvas.ts";
import { mouseEvent } from "./events.ts";

export function paintHorizontalPair(
  manager: PixelArtCanvas
): void {
  manager.brush.primary.set("#000000");
  manager.commitPixels([
    { x: 2, y: 2 }
  ]);
  manager.brush.primary.set("#FF0000");
  manager.commitPixels([
    { x: 3, y: 2 }
  ]);
}

export function selectHorizontalPair(
  canvas: HTMLCanvasElement
): void {
  canvas.dispatchEvent(
    mouseEvent("mousedown", 92, 92)
  );
  canvas.dispatchEvent(
    mouseEvent("mousemove", 96, 92)
  );
  canvas.dispatchEvent(
    new MouseEvent("mouseup", { bubbles: true })
  );
}
