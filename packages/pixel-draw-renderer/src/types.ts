// Import Third-party Dependencies
import type Color from "colorjs.io";

export type Vec2 = {
  x: number;
  y: number;
};

export type Mode = "paint" | "move" | "fill" | "select" | "uv";

export interface SelectionRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

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

export interface BrushHighlight {
  readonly size: number;
  readonly colorInline: string;
  readonly colorOutline: string;
}
