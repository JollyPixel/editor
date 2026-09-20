// Import Internal Dependencies
import type { TilesetEntry } from "../../state/index.ts";
import { formatCount } from "../blocks/blockUsage.ts";

// CONSTANTS
const kDetachedSuffix = "(detached)";

export interface TilesetTabLabelsOptions {
  /**
   * Number of blocks textured by the tileset.
   */
  blocks: number;
  /**
   * True when the open tab still edits an asset the tileset no longer links.
   * @default false
   */
  detached?: boolean;
}

export interface TilesetTabLabels {
  name: string;
  tooltip: string;
  badge: string;
}

export function tilesetTabLabels(
  entry: TilesetEntry,
  options: TilesetTabLabelsOptions
): TilesetTabLabels {
  const { blocks, detached = false } = options;
  const { label, definition } = entry;
  const origin = entry.assetId === null ? "Unlinked texture" : label;

  return {
    name: detached ? `${label} ${kDetachedSuffix}` : label,
    tooltip: `${origin} · ${definition.tileSize}px · ${formatCount(blocks, "block")}`,
    badge: String(blocks)
  };
}
