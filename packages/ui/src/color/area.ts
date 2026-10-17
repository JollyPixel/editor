// Import Internal Dependencies
import { unitRatio } from "../numeric/bounds.ts";

export interface PointerPosition {
  x: number;
  y: number;
}

export interface AreaRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface SaturationValue {
  s: number;
  v: number;
}

export function ratioFromPointer(
  pointer: PointerPosition,
  rect: AreaRect
): PointerPosition {
  return {
    x: unitRatio(
      pointer.x - rect.left,
      0,
      rect.width
    ),
    y: unitRatio(
      pointer.y - rect.top,
      0,
      rect.height
    )
  };
}

export function saturationValueFromPointer(
  pointer: PointerPosition,
  rect: AreaRect
): SaturationValue {
  const {
    x,
    y
  } = ratioFromPointer(pointer, rect);

  return {
    s: x,
    v: 1 - y
  };
}

