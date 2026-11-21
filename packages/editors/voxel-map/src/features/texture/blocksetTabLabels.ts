// Import Third-party Dependencies
import type { BlocksetEntry } from "@jolly-pixel/asset.voxel-map/runtime";

export interface BlocksetTabLabels {
  name: string;
  tooltip: string;
}

export function blocksetTabLabels(
  entry: BlocksetEntry
): BlocksetTabLabels {
  const tiles = `${entry.definition.tileSize}px tiles`;

  return {
    name: entry.label,
    tooltip: entry.linked ? tiles : `Unlinked texture · ${tiles}`
  };
}
