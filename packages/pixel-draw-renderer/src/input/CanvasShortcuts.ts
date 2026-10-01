// Import Internal Dependencies
import type { RotationDirection } from "../types.ts";

export interface CanvasShortcuts {
  panHeld: boolean;
  lineHeld: boolean;
  copy(): boolean;
  paste(): boolean;
  delete(): boolean;
  undo(): boolean;
  redo(): boolean;
  rotate(
    direction: RotationDirection
  ): boolean;
  flipHorizontal(): boolean;
  flipVertical(): boolean;
}
