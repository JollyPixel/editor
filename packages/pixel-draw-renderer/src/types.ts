// Import Third-party Dependencies
import type { RGBA8 } from "@jolly-pixel/color";

export type { RGBA8 };

export type Vec2 = {
  x: number;
  y: number;
};

export type Mode =
  | "paint"
  | "erase"
  | "move"
  | "fill"
  | "select"
  | "uv";

export type TextureView = "albedo" | "normal";

export type RotationDirection = "cw" | "ccw";

export interface SelectionRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type ByteColorInput = string | RGBA8;

export interface PeerStrokePixel {
  x: number;
  y: number;
  color: RGBA8;
}

export interface BrushHighlight {
  readonly colorInline: string;
  readonly colorOutline: string;
}
