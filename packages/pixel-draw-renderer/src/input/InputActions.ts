// Import Internal Dependencies
import type { BrushColorSlot } from "../tools/Brush.ts";
import type { Vec2 } from "../types.ts";

export interface PointerPosition {
  canvas: Vec2;
  texture: Vec2;
  boundedTexture: Vec2 | null;
}

export interface InputActions {
  readonly pansOnPrimary: boolean;
  onPointerDown(
    slot: BrushColorSlot,
    position: PointerPosition,
    ctrlKey: boolean
  ): boolean;
  onPointerMove(
    slot: BrushColorSlot,
    position: PointerPosition
  ): void;
  onPointerUp(
    slot: BrushColorSlot
  ): void;
  onCtrlWheel(
    delta: number
  ): boolean;
  onPanStart(): void;
  onPanEnd(): void;
  onHover(
    position: PointerPosition | null
  ): void;
  onMouseUp(): void;
  onBlur(): void;
}
