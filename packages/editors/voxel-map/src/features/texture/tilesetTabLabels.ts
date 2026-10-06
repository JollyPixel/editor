// Import Third-party Dependencies
import {
  BlockTextures,
  type ResolvedBlockDefinition
} from "@jolly-pixel/voxel.renderer";
import { formatCount } from "@jolly-pixel/ui";

// Import Internal Dependencies
import type { TilesetEntry } from "../tilesets/TilesetEntry.ts";

export interface TilesetTabLabels {
  name: string;
  tooltip: string;
  badge: string;
}

export function blockCountsByTileset(
  blocks: Iterable<ResolvedBlockDefinition>
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const block of blocks) {
    for (const id of BlockTextures.of(block).tilesetIds()) {
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }

  return counts;
}

export function tilesetTabLabels(
  entry: TilesetEntry,
  blocks: number
): TilesetTabLabels {
  const { label, definition } = entry;
  const origin = entry.linked ? label : "Unlinked texture";

  return {
    name: label,
    tooltip: `${origin} · ${definition.tileSize}px · ${formatCount(blocks, "block")}`,
    badge: String(blocks)
  };
}
