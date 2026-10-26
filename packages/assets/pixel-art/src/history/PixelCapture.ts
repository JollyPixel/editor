// Import Third-party Dependencies
import type { KeyedCapture } from "@jolly-pixel/history";
import type { Vec2 } from "@jolly-pixel/pixel-draw.renderer";

export class PixelCapture {
  readonly size: Vec2;
  readonly pixels: Uint8ClampedArray;
  readonly named: KeyedCapture;

  constructor(
    size: Vec2,
    pixels: Uint8ClampedArray,
    named: KeyedCapture
  ) {
    this.size = size;
    this.pixels = pixels;
    this.named = named;
  }
}
