// Import Third-party Dependencies
import type Color from "colorjs.io";

export type Vec2 = {
  x: number;
  y: number;
};

export type Mode = "paint" | "move";

/**
 * Anything accepted as a color input across the package: a CSS color string
 * (hex, rgb(), hsl(), named color, ...) or a colorjs.io `Color` instance.
 */
export type ColorInput = string | Color;

export interface RGBA {
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface DefaultViewport {
  readonly zoom: number;
  readonly camera: Readonly<Vec2>;
}

export interface DefaultPixelBuffer {
  getSize(): Vec2;
  setSize(size: Vec2): void;
  getPixels(): Uint8ClampedArray;
  setPixels(pixels: Uint8ClampedArray, size: Vec2): void;
  drawPixels(positions: Vec2[], color: RGBA): void;
  copyToMaster(): void;
  samplePixel(x: number, y: number): [number, number, number, number];
}

export interface Brush {
  readonly size: number;
  readonly colorInline: string;
  readonly colorOutline: string;
}
