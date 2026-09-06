// Import Internal Dependencies
import type { BlockShape } from "./BlockShape.ts";
import {
  tileRefForSlot,
  type ResolvedBlockDefinition
} from "../BlockDefinition.ts";
import type { ResolvedTileRef } from "../../tileset/types.ts";
import {
  buildShapeGeometry,
  type ShapeGeometry
} from "./shapeGeometry.ts";
import { baseSlotOf } from "./shapeSlots.ts";

const kEpsilon = 1e-6;
const kBoxSlots = [
  "front",
  "back",
  "left",
  "right",
  "top",
  "bottom"
] as const;

export type ShapeTextureCorner =
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right";

export interface ShapeTextureBounds {
  u0: number;
  v0: number;
  u1: number;
  v1: number;
}

export interface ShapeTexturePart {
  bounds: ShapeTextureBounds;
  corner: ShapeTextureCorner | null;
}

export interface ShapeTextureSlotLayout {
  slot: string;
  bounds: ShapeTextureBounds;
  parts: readonly ShapeTexturePart[];
  start: number;
  count: number;
}

export interface ShapeTextureLayout {
  slots: readonly ShapeTextureSlotLayout[];
  isBox: boolean;
}

export interface ResolvedBlockTextureSlot extends ShapeTextureSlotLayout {
  tile: ResolvedTileRef;
}

/** Resolves shape slots and block texture fallback rules in one place. */
export function resolvedBlockTextureSlots(
  block: ResolvedBlockDefinition,
  shape: BlockShape
): readonly ResolvedBlockTextureSlot[] {
  return shapeTextureLayout(shape).slots.flatMap((entry) => {
    const tile = tileRefForSlot(block, entry.slot);

    return tile ? [{ ...entry, tile }] : [];
  });
}

/** Describes how a block shape's authored geometry occupies texture slots. */
export function shapeTextureLayout(
  shape: BlockShape
): ShapeTextureLayout {
  const geometry = buildShapeGeometry(shape);
  let everySlotIsOneFullQuad = true;
  const slots = geometry.ranges.map((range): ShapeTextureSlotLayout => {
    const bounds = boundsOf(geometry, range.start, range.count);
    const parts = polygonsOf(geometry, range.start, range.definitions);
    if (
      parts.length !== 1 ||
      parts[0].corner !== null ||
      !coversTile(bounds)
    ) {
      everySlotIsOneFullQuad = false;
    }

    return {
      slot: range.slot,
      bounds,
      parts,
      start: range.start,
      count: range.count
    };
  }).sort((a, b) => slotOrder(a.slot, b.slot));

  return {
    slots,
    isBox: slots.length === kBoxSlots.length &&
      kBoxSlots.every((slot) => slots.some((entry) => entry.slot === slot)) &&
      everySlotIsOneFullQuad
  };
}

function slotOrder(a: string, b: string): number {
  const base = kBoxSlots.indexOf(baseSlotOf(a) as typeof kBoxSlots[number]) -
    kBoxSlots.indexOf(baseSlotOf(b) as typeof kBoxSlots[number]);

  return base === 0 ? suffixOf(a) - suffixOf(b) : base;
}

function suffixOf(slot: string): number {
  const separator = slot.indexOf(".");

  return separator === -1 ? 0 : Number(slot.slice(separator + 1));
}

function polygonsOf(
  geometry: ShapeGeometry,
  start: number,
  definitions: readonly { vertices: readonly unknown[]; }[]
): ShapeTexturePart[] {
  const polygons: ShapeTexturePart[] = [];
  let cursor = start;
  for (const definition of definitions) {
    const count = definition.vertices.length;
    const bounds = boundsOf(geometry, cursor, count);
    polygons.push({
      bounds,
      corner: count === 3 ? rightAngleCorner(geometry, cursor, bounds) : null
    });
    cursor += count;
  }

  return polygons;
}

function boundsOf(
  geometry: ShapeGeometry,
  start: number,
  count: number
): ShapeTextureBounds {
  let u0 = Infinity;
  let v0 = Infinity;
  let u1 = -Infinity;
  let v1 = -Infinity;
  for (let index = start; index < start + count; index++) {
    const u = geometry.uvs[index * 2];
    const v = geometry.uvs[(index * 2) + 1];
    u0 = Math.min(u0, u);
    u1 = Math.max(u1, u);
    v0 = Math.min(v0, v);
    v1 = Math.max(v1, v);
  }

  return { u0, v0, u1, v1 };
}

function coversTile(bounds: ShapeTextureBounds): boolean {
  return near(bounds.u0, 0) && near(bounds.v0, 0) &&
    near(bounds.u1, 1) && near(bounds.v1, 1);
}

function rightAngleCorner(
  geometry: ShapeGeometry,
  start: number,
  bounds: ShapeTextureBounds
): ShapeTextureCorner | null {
  const uvs: [number, number][] = [];
  for (let index = start; index < start + 3; index++) {
    uvs.push([geometry.uvs[index * 2], geometry.uvs[(index * 2) + 1]]);
  }

  for (let index = 0; index < 3; index++) {
    const [u, v] = uvs[index];
    const [firstU, firstV] = uvs[(index + 1) % 3];
    const [secondU, secondV] = uvs[(index + 2) % 3];
    if (
      (near(firstU, u) && near(secondV, v)) ||
      (near(secondU, u) && near(firstV, v))
    ) {
      const vertical = near(v, bounds.v1) ? "top" : "bottom";
      const horizontal = near(u, bounds.u1) ? "right" : "left";

      return `${vertical}-${horizontal}`;
    }
  }

  return null;
}

function near(value: number, target: number): boolean {
  return Math.abs(value - target) < kEpsilon;
}
