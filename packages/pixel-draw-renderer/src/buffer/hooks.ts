// Import Internal Dependencies
import type {
  RGBA,
  Vec2
} from "../types.ts";

/**
 * @notes
 * originTimestamp is set only when replaying an undo/redo;
 * preserved as the network timestamp instead of "now".
 */
export type PixelBufferHookEvent =
  | {
    action: "stroke";
    metadata: {
      color: RGBA;
      positions: Vec2[];
    };
    originTimestamp?: number;
  }
  | {
    action: "resized";
    metadata: {
      size: Vec2;
    };
    originTimestamp?: number;
  }
  | {
    action: "texture-replaced";
    metadata: {
      size: Vec2;
      pixels: string;
    };
    originTimestamp?: number;
  };

export type PixelBufferHookAction = PixelBufferHookEvent["action"];

export type PixelBufferHookListener = (
  event: PixelBufferHookEvent
) => void;
