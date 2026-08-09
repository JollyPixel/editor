// The handlers below are intentional no-op extension points overridden by
// concrete modes (see engine/src/systems/Scene.ts for the same pattern).
/* eslint-disable no-empty-function */

// Import Internal Dependencies
import type {
  Mode,
  Vec2
} from "../../types.ts";

/**
 * A single interaction mode (`paint` / `fill` / `select` / `uv` / `move`). Each
 * mode owns its enter/exit lifecycle, its cursor, its brush-highlight size, and
 * the pointer/keyboard gestures it cares about.
 */
export abstract class InteractionMode {
  abstract readonly id: Mode;

  onEnter(_previous: Mode): void {}
  onExit(_next: Mode): void {}

  /**
   * CSS cursor for the current tool state. Re-queried by the router after each
   * pointer press/release, on blur, and on mode change.
   */
  cursor(): string {
    return "";
  }

  /**
   * Brush-highlight size (in texture pixels) while in this mode. Most modes
   * don't show it, so the default is the brush's own size.
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
