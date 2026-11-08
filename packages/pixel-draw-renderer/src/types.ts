// Import Third-party Dependencies
import type {
  ByteColorInput,
  RGBA8
} from "@jolly-pixel/color";

export type {
  ByteColorInput,
  RGBA8
};

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

export type MirrorAxis = "horizontal" | "vertical";

export interface SelectionRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PeerStrokePixel {
  x: number;
  y: number;
  color: RGBA8;
}

export interface BrushHighlight {
  readonly colorInline: string;
  readonly colorOutline: string;
}
