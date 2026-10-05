// Import Internal Dependencies
import { uvTargetKey } from "../../uv/region/UVTarget.ts";
import { geometryKey } from "../../uv/geometry/geometry.ts";
import type { UVMap } from "../../uv/map/UVMap.ts";
import type {
  UVGeometry,
  UVRegion,
  UVSlot
} from "../../uv/region/UVRegion.ts";

export interface UVOverlayEntry {
  key: string;
  shapeKey: string;
  region: UVRegion;
  slot: UVSlot | null;
  geometry: UVGeometry;
  selected: boolean;
  peerColor: string | null;
}

export interface UVOverlayLayerState {
  /**
   * UV target keys whose borders a peer drag preview replaces.
   */
  ghostSuppressed: ReadonlySet<string>;
  /**
   * Drawn in place of the stored region with the same id.
   */
  preview: UVRegion | null;
  /**
   * Peer color by region id.
   */
  peerSelections: ReadonlyMap<string, string>;
}

export function projectUVOverlay(
  uvMap: UVMap,
  layer: UVOverlayLayerState
): UVOverlayEntry[] {
  const {
    ghostSuppressed,
    preview,
    peerSelections
  } = layer;
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
    const peerColor = region.id === selectedRegionId ?
      null :
      peerSelections.get(region.id) ?? null;

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
        shapeKey: `${region.id}|${geometryKey(geometry)}`,
        region,
        slot,
        geometry,
        selected: region.id === selectedRegionId &&
          (grouped || slot === selectedSlot),
        peerColor
      });
    }
  }

  return entries;
}

export function uvOverlayPaintOrder(
  entries: UVOverlayEntry[]
): UVOverlayEntry[] {
  const plain: UVOverlayEntry[] = [];
  const peer: UVOverlayEntry[] = [];
  const selected: UVOverlayEntry[] = [];
  for (const entry of entries) {
    if (entry.selected) {
      selected.push(entry);
    }
    else if (entry.peerColor === null) {
      plain.push(entry);
    }
    else {
      peer.push(entry);
    }
  }

  return [
    ...plain,
    ...peer,
    ...selected
  ];
}
