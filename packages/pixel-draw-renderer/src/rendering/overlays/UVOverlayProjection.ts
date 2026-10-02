// Import Internal Dependencies
import { uvTargetKey } from "../../uv/region/UVTarget.ts";
import type { UVMap } from "../../uv/map/UVMap.ts";
import type {
  UVGeometry,
  UVRegion,
  UVSlot
} from "../../uv/region/UVRegion.ts";

export interface UVOverlayEntry {
  key: string;
  region: UVRegion;
  slot: UVSlot | null;
  geometry: UVGeometry;
  selected: boolean;
  stacked?: number;
}

export function projectUVOverlay(
  uvMap: UVMap,
  ghostSuppressed: ReadonlySet<string>,
  preview: UVRegion | null
): UVOverlayEntry[] {
  const selectedRegionId = uvMap.selectedRegionId;
  const selectedSlot = uvMap.selectedSlot;
  const entries: UVOverlayEntry[] = [];

  for (const stored of uvMap.regions) {
    const region = preview?.id === stored.id ? preview : stored;
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

    for (const { slot, geometry } of region.slotsOf()) {
      const key = uvTargetKey({
        regionId: region.id,
        slot
      });
      if (ghostSuppressed.has(key)) {
        continue;
      }

      entries.push({
        key,
        region,
        slot,
        geometry,
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
