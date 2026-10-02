// Import Third-party Dependencies
import { ColorPalette } from "@jolly-pixel/color";

// Import Internal Dependencies
import { clamp } from "../../utils/math.ts";
import { clampRegion } from "./canvasBounds.ts";
import { UVSlotMap } from "../region/UVSlotMap.ts";
import {
  DEFAULT_UV_SLOTS,
  UVRegion,
  type UVGeometry,
  type UVRegionState,
  type UVSlot
} from "../region/UVRegion.ts";
import type {
  SelectionRect,
  Vec2
} from "../../types.ts";

export interface UVRegionCreateOptions {
  width: number;
  height: number;
  name?: string;
  activeSlots?: readonly UVSlot[];
  slotGeometries?: Partial<Record<UVSlot, UVSlotGeometryTemplate>>;
  /**
   * @default "free" for regions with topology, otherwise "stacked"
   */
  state?: UVRegionState;
  /**
   * @default a generated id
   */
  id?: string;
  /**
   * @default the next color in the built-in palette
   */
  color?: string;
}

export interface UVSlotSize {
  width?: number;
  height?: number;
}

export type UVSlotGeometryTemplate = UVSlotSize & (
  | { shape: "rectangle"; }
  | { shape: "triangle"; corner: "top-left" | "top-right" | "bottom-left" | "bottom-right"; }
);

// CONSTANTS
const kCascadeStep = 16;

export class UVRegionFactory {
  #getCanvasSize: () => Vec2;
  #cascadeIndex = 0;
  #palette = new ColorPalette();

  constructor(
    getCanvasSize: () => Vec2
  ) {
    this.#getCanvasSize = getCanvasSize;
  }

  create(
    options: UVRegionCreateOptions
  ): UVRegion {
    const size = this.#getCanvasSize();
    const width = clamp(options.width, 1, Math.max(1, size.x));
    const height = clamp(options.height, 1, Math.max(1, size.y));
    const position = this.#nextCascadePosition(
      width,
      height,
      size
    );

    const rect = {
      x: position.x,
      y: position.y,
      width,
      height
    };
    const identity = {
      id: options.id ?? crypto.randomUUID(),
      name: options.name,
      color: options.color ?? this.#palette.next()
    };
    const { activeSlots, slotGeometries } = options;
    const hasTopology = activeSlots !== undefined || slotGeometries !== undefined;
    const state = options.state ?? (hasTopology ? "free" : "stacked");
    const slots = [
      ...new Set([
        ...DEFAULT_UV_SLOTS,
        ...(activeSlots ?? []),
        ...Object.keys(slotGeometries ?? {})
      ])
    ];
    const faces = UVSlotMap.map(
      (slot) => geometryFrom(slotGeometries?.[slot], rect, size),
      slots
    );
    const activeFaces = [
      ...(activeSlots ?? DEFAULT_UV_SLOTS)
    ];
    if (state === "stacked") {
      return hasTopology ?
        new UVRegion({
          ...identity,
          state,
          rect,
          activeFaces,
          faces
        }) :
        new UVRegion({
          ...identity,
          state,
          rect
        });
    }

    const spread = new UVRegion({
      ...identity,
      state: "free",
      activeFaces,
      faces
    });

    return state === "unfolded" ?
      clampRegion(spread.unfold(), size) :
      spread;
  }

  reset(): void {
    this.#cascadeIndex = 0;
    this.#palette.reset();
  }

  #nextCascadePosition(
    width: number,
    height: number,
    size: Vec2
  ): Vec2 {
    const maxX = Math.max(0, size.x - width);
    const maxY = Math.max(0, size.y - height);
    const colsPerRow = Math.max(
      1,
      Math.floor(maxX / kCascadeStep) + 1
    );

    const col = this.#cascadeIndex % colsPerRow;
    const row = Math.floor(this.#cascadeIndex / colsPerRow);
    this.#cascadeIndex++;

    return {
      x: clamp(col * kCascadeStep, 0, maxX),
      y: clamp(row * kCascadeStep, 0, maxY)
    };
  }
}

function geometryFrom(
  template: UVSlotGeometryTemplate | undefined,
  regionRect: SelectionRect,
  size: Vec2
): UVGeometry {
  const rect = {
    ...regionRect,
    width: clamp(template?.width ?? regionRect.width, 1, Math.max(1, size.x)),
    height: clamp(template?.height ?? regionRect.height, 1, Math.max(1, size.y))
  };

  return template?.shape === "triangle" ?
    { shape: "triangle", corner: template.corner, rect } :
    rect;
}
