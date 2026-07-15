// Import Internal Dependencies
import type { RGBA, Vec2 } from "../types.ts";

export type PixelBufferHookEvent =
  | {
    action: "stroke";
    metadata: {
      color: RGBA;
      positions: Vec2[];
    };
  }
  | {
    action: "resized";
    metadata: {
      size: Vec2;
    };
  }
  | {
    action: "texture-replaced";
    metadata: {
      size: Vec2;
      pixels: string;
    };
  };

export type PixelBufferHookAction = PixelBufferHookEvent["action"];

export type PixelBufferHookListener = (
  event: PixelBufferHookEvent
) => void;
