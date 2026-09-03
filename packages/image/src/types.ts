/** A row-major, straight-alpha RGBA8 image. */
export interface DecodedImage {
  /** Width in pixels. */
  readonly width: number;
  /** Height in pixels. */
  readonly height: number;
  /** Four bytes per pixel in red, green, blue, alpha order. */
  readonly data: Uint8ClampedArray;
}
