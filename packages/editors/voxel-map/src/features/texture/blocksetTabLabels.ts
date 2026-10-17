// Import Internal Dependencies
import type { BlocksetEntry } from "../blocksets/BlocksetEntry.ts";

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
