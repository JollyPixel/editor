// Import Internal Dependencies
import type {
  RGBA8,
  SelectionRect,
  Vec2
} from "../types.ts";
import type { ColorGroup } from "./colorGroups.ts";

export interface DefaultPixelBuffer {
  size(): Vec2;
  resize(
    size: Vec2
  ): void;
  pixels(): Uint8ClampedArray;
  replacePixels(
    pixels: Uint8ClampedArray,
    size: Vec2
  ): void;
  drawPixels(
    positions: Iterable<Vec2>,
    color: RGBA8
  ): void;
  drawColorGroups(
    groups: Iterable<ColorGroup>
  ): void;
  copyToMaster(): void;
  samplePixel(
    x: number,
    y: number
  ): [number, number, number, number];
  samplePixels(
    positions: Vec2[]
  ): RGBA8[];
  positionsOf(
    color: RGBA8,
    mask?: Uint8Array
  ): Vec2[];
  hasTransparency(
    rect: SelectionRect
  ): boolean;
}
