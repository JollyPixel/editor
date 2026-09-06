// Import Third-party Dependencies
import type { UVSlot } from "@jolly-pixel/pixel-draw.renderer";
export type { PixelTextureSource } from "../texture/types.ts";

export interface FaceVertexRange {
  start: number;
  count: number;
}

export type FaceRanges = Partial<
  Record<UVSlot, readonly FaceVertexRange[]>
>;
