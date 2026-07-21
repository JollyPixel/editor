// Import Internal Dependencies
import type {
  PixelArtCanvas
} from "#src/PixelArtCanvas.ts";
import { mouseEvent } from "./events.ts";

// Rotate/flip keybindings, shared between the standalone R/H/V coverage and
// the undo/redo-of-a-transform coverage in the select-mode specs.
export function rotateKey(): KeyboardEvent {
  return new KeyboardEvent(
    "keydown",
    {
      key: "r",
      code: "KeyR",
      bubbles: true,
      cancelable: true
    }
  );
}

export function flipHorizontalKey(): KeyboardEvent {
  return new KeyboardEvent(
    "keydown",
    {
      key: "h",
      code: "KeyH",
      bubbles: true,
      cancelable: true
    }
  );
}

export function flipVerticalKey(): KeyboardEvent {
  return new KeyboardEvent(
    "keydown",
    {
      key: "v",
      code: "KeyV",
      bubbles: true,
      cancelable: true
    }
  );
}

/** A 2-wide x 1-tall pair over (2,2)-(3,2): black at (2,2), red at (3,2). */
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

/** Drags a selection rectangle over the pair painted by paintHorizontalPair. */
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
