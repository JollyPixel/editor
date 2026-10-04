// Import Internal Dependencies
import type { Vec2 } from "../../types.ts";
import { coveredPixels } from "../geometry/geometry.ts";
import type { UVRegion } from "./UVRegion.ts";
import type { UVGeometry } from "../geometry/types.ts";

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
  const mask = new Uint8Array(size.x * size.y);

  for (const geometry of geometries) {
    for (const index of coveredPixels(geometry, size)) {
      mask[index] = 1;
    }
  }

  return mask;
}
