// Import Internal Dependencies
import type {
  RGBA,
  SelectionRect,
  Vec2
} from "../types.ts";
import type { UVRegion } from "../uv/UVRegion.ts";

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
  }
  | {
    action: "global-fill";
    metadata: {
      fromColor: RGBA;
      toColor: RGBA;
    };
    originTimestamp?: number;
  }
  | {
    action: "uv-region-created";
    metadata: {
      region: UVRegion;
    };
    originTimestamp?: number;
  }
  | {
    action: "uv-region-deleted";
    metadata: {
      id: string;
    };
    originTimestamp?: number;
  }
  | {
    action: "uv-region-moved";
    metadata: {
      id: string;
      rect: SelectionRect;
    };
    originTimestamp?: number;
  };

export type PixelBufferHookAction = PixelBufferHookEvent["action"];

export type PixelBufferHookListener = (
  event: PixelBufferHookEvent
) => void;
