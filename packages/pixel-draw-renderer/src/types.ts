// Import Third-party Dependencies
import type { RGBA8 } from "@jolly-pixel/color";

export type { RGBA8 };

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
 * (hex, rgb(), hsl(), named color, ...) or byte channels.
 */
export type ByteColorInput = string | RGBA8;

/**
 * Wire and render payload for one uncommitted peer-stroke pixel.
 */
export interface PeerStrokePixel {
  x: number;
  y: number;
  color: RGBA8;
}

export interface BrushHighlight {
  readonly size: number;
  readonly colorInline: string;
  readonly colorOutline: string;
}
