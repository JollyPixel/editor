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

/**
 * Returns top-left-relative pointer ratios clamped to the rectangle.
 * Zero-sized axes return 0.
 */
export function ratioFromPointer(
  pointer: PointerPosition,
  rect: AreaRect
): PointerPosition {
  return {
    x: ratio(
      pointer.x - rect.left,
      rect.width
    ),
    y: ratio(
      pointer.y - rect.top,
      rect.height
    )
  };
}

/**
 * Maps x to saturation and inverted y to value.
 */
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

function ratio(
  offset: number,
  size: number
): number {
  if (size <= 0) {
    return 0;
  }

  return Math.min(
    1,
    Math.max(0, offset / size)
  );
}
