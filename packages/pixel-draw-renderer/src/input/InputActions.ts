// Import Internal Dependencies
import type { Vec2 } from "../types.ts";

/**
 * Receives coordinate-resolved actions from `InputController`.
 */
export interface InputActions {
  /** Starts a primary interaction and returns whether to track its drag. */
  onPrimaryDown(
    position: Vec2
  ): boolean;
  /** Reports movement during a tracked primary drag. */
  onPrimaryMove(
    position: Vec2
  ): void;
  /** Ends a tracked primary drag. */
  onPrimaryUp(): void;
  /** Starts a secondary interaction and returns whether to track its drag. */
  onSecondaryDown(
    position: Vec2,
    ctrlKey: boolean
  ): boolean;
  /** Reports movement during a tracked secondary drag. */
  onSecondaryMove(
    position: Vec2
  ): void;
  /** Ends a tracked secondary drag. */
  onSecondaryUp(): void;
  onPanStart(): void;
  onPanMove(delta: Vec2): void;
  onPanEnd(): void;
  onZoom(
    delta: number,
    center: Vec2
  ): void;
  /** Reports the canvas position, or `null` outside the canvas. */
  onCanvasHover(
    position: Vec2 | null
  ): void;
  /** Reports the bounded texture position, or `null` outside the texture. */
  onTextureCursorMove(
    position: Vec2 | null
  ): void;
  /** Reports every canvas or window mouseup. */
  onMouseUp(): void;
  /** Reports a non-repeat Shift press outside editable UI. */
  onShiftDown(): void;
  onShiftUp(): void;
  /** Reports a non-repeat Space press while hovering the canvas. */
  onSpaceDown(): void;
  onSpaceUp(): void;
  onBlur(): void;
  /** Returns whether the browser default should be suppressed. */
  onCopy(): boolean;
  onPaste(): boolean;
  onDelete(): boolean;
  onUndo(): boolean;
  onRedo(): boolean;
  onRotate(): boolean;
  onFlipHorizontal(): boolean;
  onFlipVertical(): boolean;
}
