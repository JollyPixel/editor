// Import Third-party Dependencies
import {
  BlockTextures,
  type ResolvedBlockDefinition
} from "@jolly-pixel/voxel.renderer";
import { formatCount } from "@jolly-pixel/ui";

// Import Internal Dependencies
import type { BlocksetEntry } from "../blocksets/BlocksetEntry.ts";

export interface BlocksetTabLabels {
  name: string;
  tooltip: string;
  badge: string;
}

export function blockCountsByBlockset(
  blocks: Iterable<ResolvedBlockDefinition>
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const block of blocks) {
    for (const id of BlockTextures.of(block).blocksetIds()) {
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }

  return counts;
}

export function blocksetTabLabels(
  entry: BlocksetEntry,
  blocks: number
): BlocksetTabLabels {
  const { label, definition } = entry;
  const origin = entry.linked ? label : "Unlinked texture";

  return {
    name: label,
    tooltip: `${origin} · ${definition.tileSize}px · ${formatCount(blocks, "block")}`,
    badge: String(blocks)
  };
}
