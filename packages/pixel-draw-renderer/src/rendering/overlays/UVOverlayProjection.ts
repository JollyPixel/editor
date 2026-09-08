// Import Internal Dependencies
import {
  geometryAt,
  rectOf
} from "../../uv/geometry.ts";
import {
  uvTargetKey,
  type UVTarget
} from "../../uv/UVTarget.ts";
import type { UVMap } from "../../uv/UVMap.ts";
import type {
  UVGeometry,
  UVRegion,
  UVSlot
} from "../../uv/UVRegion.ts";
import type {
  SelectionRect,
  Vec2
} from "../../types.ts";

export interface UVLiveOverride {
  target: UVTarget;
  rect: SelectionRect;
}

export interface UVOverlayEntry {
  key: string;
  region: UVRegion;
  slot: UVSlot | null;
  geometry: UVGeometry;
  selected: boolean;
  stacked?: number;
}

function deltaOf(
  from: SelectionRect,
  to: SelectionRect
): Vec2 {
  return {
    x: to.x - from.x,
    y: to.y - from.y
  };
}

function liveGeometry(
  geometry: UVGeometry,
  rect: SelectionRect | null,
  delta: Vec2 | null
): UVGeometry {
  if (rect !== null) {
    return geometryAt(geometry, rect);
  }
  if (delta === null) {
    return geometry;
  }

  const bounds = rectOf(geometry);

  return geometryAt(geometry, {
    ...bounds,
    x: bounds.x + delta.x,
    y: bounds.y + delta.y
  });
}

export function projectUVOverlay(
  uvMap: UVMap,
  override: UVLiveOverride | null,
  ghostSuppressed: ReadonlySet<string>
): UVOverlayEntry[] {
  const selectedRegionId = uvMap.selectedRegionId;
  const selectedSlot = uvMap.selectedSlot;
  const entries: UVOverlayEntry[] = [];

  for (const region of uvMap.regions) {
    if (!uvMap.isVisible(region.id)) {
      continue;
    }

    const grouped = region.state === "unfolded";
    const regionKey = uvTargetKey({
      regionId: region.id,
      slot: null
    });
    if (grouped && ghostSuppressed.has(regionKey)) {
      continue;
    }

    const groupDelta = grouped &&
      override?.target.regionId === region.id &&
      override.target.slot === null ?
      deltaOf(region.bounds, override.rect) :
      null;

    for (const { slot, geometry } of region.slotsOf()) {
      const target: UVTarget = {
        regionId: region.id,
        slot
      };
      const key = uvTargetKey(target);
      if (ghostSuppressed.has(key)) {
        continue;
      }

      const overridden = override !== null &&
        override.target.regionId === region.id &&
        override.target.slot === slot;
      entries.push({
        key,
        region,
        slot,
        geometry: liveGeometry(
          geometry,
          overridden ? override.rect : null,
          groupDelta
        ),
        selected: region.id === selectedRegionId &&
          (grouped || slot === selectedSlot)
      });
    }
  }

  return entries;
}

export function uvOverlayPaintOrder(
  entries: UVOverlayEntry[]
): UVOverlayEntry[] {
  const selected = entries.filter((entry) => entry.selected);
  if (selected.length === 0) {
    return entries;
  }

  return [
    ...entries.filter((entry) => !entry.selected),
    ...selected
  ];
}
