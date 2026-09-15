// Import Internal Dependencies
import type { Vec2 } from "../types.ts";
import { pointInRect } from "../utils/math.ts";
import {
  pointInGeometry,
  rectOf
} from "./geometry.ts";
import type { UVRegion } from "./UVRegion.ts";
import type { UVGeometry } from "./types.ts";

export function uvSlotGeometries(
  regions: Iterable<UVRegion>
): UVGeometry[] {
  const geometries: UVGeometry[] = [];

  for (const region of regions) {
    for (const { geometry } of region.slotsOf()) {
      geometries.push(geometry);
    }
  }

  return geometries;
}

export function uvSlotMask(
  geometries: Iterable<UVGeometry>,
  size: Vec2
): Uint8Array {
  const { x: width, y: height } = size;
  const mask = new Uint8Array(width * height);
  const center: Vec2 = { x: 0, y: 0 };

  for (const geometry of geometries) {
    const bounds = rectOf(geometry);
    const minX = Math.max(0, Math.floor(bounds.x));
    const minY = Math.max(0, Math.floor(bounds.y));
    const maxX = Math.min(width, Math.ceil(bounds.x + bounds.width));
    const maxY = Math.min(height, Math.ceil(bounds.y + bounds.height));
    const isRect = !("shape" in geometry);

    for (let y = minY; y < maxY; y++) {
      center.y = y + 0.5;
      for (let x = minX; x < maxX; x++) {
        const index = (y * width) + x;
        if (mask[index] === 1) {
          continue;
        }

        center.x = x + 0.5;
        if (
          isRect ?
            pointInRect(center, bounds) :
            pointInGeometry(center, geometry)
        ) {
          mask[index] = 1;
        }
      }
    }
  }

  return mask;
}
