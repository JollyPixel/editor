// Import Internal Dependencies
import type {
  RGBA,
  Vec2
} from "../types.ts";

export interface DefaultPixelBuffer {
  size(): Vec2;
  resize(size: Vec2): void;
  pixels(): Uint8ClampedArray;
  replacePixels(
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
  samplePixels(
    positions: Vec2[]
  ): RGBA[];
}
