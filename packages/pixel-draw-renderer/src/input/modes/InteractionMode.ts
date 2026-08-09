// Concrete modes override these intentional no-op extension points.
/* eslint-disable no-empty-function */

// Import Internal Dependencies
import type {
  Mode,
  Vec2
} from "../../types.ts";

export abstract class InteractionMode {
  abstract readonly id: Mode;

  onEnter(_previous: Mode): void {}
  onExit(_next: Mode): void {}

  /**
   * Re-evaluated after pointer, blur, and mode transitions.
   */
  cursor(): string {
    return "";
  }

  /**
   * Defaults to the brush size when the mode has no custom highlight.
   */
  highlightSize(brushSize: number): number {
    return brushSize;
  }

  onPrimaryDown(_pos: Vec2): boolean {
    return false;
  }

  onPrimaryMove(_pos: Vec2): void {}
  onPrimaryUp(): void {}

  onSecondaryDown(
    _pos: Vec2,
    _ctrlKey: boolean
  ): boolean {
    return false;
  }

  onSecondaryMove(_pos: Vec2): void {}
  onSecondaryUp(): void {}
  onHover(_position: Vec2 | null): void {}
  onCursorMove(_pos: Vec2 | null): void {}
  onMouseUp(): void {}
  onShiftDown(): void {}
  onShiftUp(): void {}
  onBlur(): void {}
  onCopy(): boolean {
    return false;
  }

  onPaste(): boolean {
    return false;
  }

  onDelete(): boolean {
    return false;
  }

  onRotate(): boolean {
    return false;
  }

  onFlipHorizontal(): boolean {
    return false;
  }

  onFlipVertical(): boolean {
    return false;
  }
}
