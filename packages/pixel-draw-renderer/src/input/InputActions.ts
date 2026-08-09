// Import Internal Dependencies
import type { Vec2 } from "../types.ts";

export interface InputActions {
  /**
   * Returns whether the primary drag should be tracked.
   */
  onPrimaryDown(
    position: Vec2
  ): boolean;
  onPrimaryMove(
    position: Vec2
  ): void;
  onPrimaryUp(): void;
  /**
   * Returns whether the secondary drag should be tracked.
   */
  onSecondaryDown(
    position: Vec2,
    ctrlKey: boolean
  ): boolean;
  onSecondaryMove(
    position: Vec2
  ): void;
  onSecondaryUp(): void;
  onPanStart(): void;
  onPanMove(delta: Vec2): void;
  onPanEnd(): void;
  onZoom(
    delta: number,
    center: Vec2
  ): void;
  /**
   * Reports the canvas position, or `null` outside the canvas.
   */
  onCanvasHover(
    position: Vec2 | null
  ): void;
  /**
   * Reports the bounded texture position, or `null` outside the texture.
   */
  onTextureCursorMove(
    position: Vec2 | null
  ): void;
  /**
   * Receives every canvas or window mouseup.
   */
  onMouseUp(): void;
  onShiftDown(): void;
  onShiftUp(): void;
  onSpaceDown(): void;
  onSpaceUp(): void;
  onBlur(): void;
  /**
   * Returns whether to suppress the browser default.
   */
  onCopy(): boolean;
  onPaste(): boolean;
  onDelete(): boolean;
  onUndo(): boolean;
  onRedo(): boolean;
  onRotate(): boolean;
  onFlipHorizontal(): boolean;
  onFlipVertical(): boolean;
}
