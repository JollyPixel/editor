// Import Internal Dependencies
import type { TilesetEntry } from "../tilesets/tilesetEntry.ts";
import { formatCount } from "../../shared/format.ts";

export interface TilesetTabLabels {
  name: string;
  tooltip: string;
  badge: string;
}

export function tilesetTabLabels(
  entry: TilesetEntry,
  blocks: number
): TilesetTabLabels {
  const { label, definition } = entry;
  const origin = entry.assetId === null ? "Unlinked texture" : label;

  return {
    name: label,
    tooltip: `${origin} · ${definition.tileSize}px · ${formatCount(blocks, "block")}`,
    badge: String(blocks)
  };
}
