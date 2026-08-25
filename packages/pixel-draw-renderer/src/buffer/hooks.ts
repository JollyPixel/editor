// Import Internal Dependencies
import type {
  RGBA8,
  SelectionRect,
  Vec2
} from "../types.ts";
import type {
  UVFace,
  UVRegionData
} from "../uv/UVRegion.ts";

/**
 * `originTimestamp` preserves the original network timestamp during replay.
 */
export type PixelBufferHookEvent =
  | {
    action: "stroke";
    metadata: {
      color: RGBA8;
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
      fromColor: RGBA8;
      toColor: RGBA8;
    };
    originTimestamp?: number;
  }
  | {
    action: "select-edit";
    metadata: {
      positions: Vec2[];
      colors: RGBA8[];
    };
    originTimestamp?: number;
  }
  | {
    action: "uv-region-created";
    metadata: {
      region: UVRegionData;
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
      face: UVFace | null;
      rect: SelectionRect;
    };
    originTimestamp?: number;
  }
  | {
    action: "uv-region-state-changed";
    metadata: {
      region: UVRegionData;
    };
    originTimestamp?: number;
  };

export type PixelBufferHookAction = PixelBufferHookEvent["action"];

export type PixelBufferHookListener = (
  event: PixelBufferHookEvent
) => void;
