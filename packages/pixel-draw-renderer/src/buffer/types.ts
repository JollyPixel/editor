// Import Internal Dependencies
import type { RGBA, Vec2 } from "../types.ts";

export interface DefaultPixelBuffer {
  getSize(): Vec2;
  setSize(size: Vec2): void;
  getPixels(): Uint8ClampedArray;
  setPixels(
    pixels: Uint8ClampedArray,
    size: Vec2
  ): void;
  drawPixels(
    positions: Iterable<Vec2>,
    color: RGBA
  ): void;
  copyToMaster(): void;
  samplePixel(
    x: number,
    y: number
  ): [number, number, number, number];
}
