// Concrete modes override these intentional no-op extension points.
/* eslint-disable no-empty-function */

// Import Internal Dependencies
import type { BrushColorSlot } from "../../tools/Brush.ts";
import type { PointerPosition } from "../InputActions.ts";
import type {
  Mode,
  RotationDirection,
  Vec2
} from "../../types.ts";

export abstract class InteractionMode {
  abstract readonly id: Mode;
  readonly writesPixels: boolean = false;
  readonly pansOnPrimary: boolean = false;

  onExit(): void {}

  cursor(): string {
    return "";
  }

  onPointerDown(
    _slot: BrushColorSlot,
    _position: PointerPosition,
    _ctrlKey: boolean
  ): boolean {
    return false;
  }

  onPointerMove(
    _slot: BrushColorSlot,
    _position: PointerPosition
  ): void {}
  onPointerUp(_slot: BrushColorSlot): void {}
  onHover(_position: Vec2 | null): void {}
  onCursorMove(_position: Vec2 | null): void {}
  onMouseUp(): void {}
  onLineHeldChange(_held: boolean): void {}
  onBlur(): void {}
  onCtrlWheel(_delta: number): boolean {
    return false;
  }

  onSelectAll(): boolean {
    return false;
  }

  onDelete(): boolean {
    return false;
  }

  onRotate(
    _direction: RotationDirection
  ): boolean {
    return false;
  }

  onFlipHorizontal(): boolean {
    return false;
  }

  onFlipVertical(): boolean {
    return false;
  }
}
