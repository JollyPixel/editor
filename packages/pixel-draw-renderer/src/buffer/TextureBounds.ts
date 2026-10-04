// Import Internal Dependencies
import type { Vec2 } from "../types.ts";

export class TextureBounds {
  static isSize(
    value: unknown
  ): value is Vec2 {
    return typeof value === "object" &&
      value !== null &&
      "x" in value &&
      "y" in value &&
      isPositiveInteger(value.x) &&
      isPositiveInteger(value.y);
  }

  readonly maxSize: number;

  constructor(
    maxSize: number
  ) {
    if (
      !Number.isInteger(maxSize) ||
      maxSize <= 0
    ) {
      throw new RangeError("PixelBuffer maxSize must be a positive integer");
    }

    this.maxSize = maxSize;
  }

  accepts(
    size: Vec2
  ): boolean {
    return TextureBounds.isSize(size) &&
      size.x <= this.maxSize &&
      size.y <= this.maxSize;
  }

  assert(
    size: Vec2
  ): void {
    if (!this.accepts(size)) {
      throw new RangeError(
        `PixelBuffer dimensions must be positive integers no greater than ${this.maxSize}`
      );
    }
  }
}

function isPositiveInteger(
  value: unknown
): value is number {
  return typeof value === "number" &&
    Number.isInteger(value) &&
    value > 0;
}
