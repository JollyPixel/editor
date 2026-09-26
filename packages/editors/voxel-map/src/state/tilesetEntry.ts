// Import Third-party Dependencies
import type { TilesetDefinition } from "@jolly-pixel/voxel.renderer";

export interface TilesetEntry {
  readonly definition: TilesetDefinition;
  readonly assetId: string | null;
  readonly label: string;
}

export function definitionsEqual(
  left: TilesetDefinition,
  right: TilesetDefinition
): boolean {
  return left.id === right.id &&
    left.slot === right.slot &&
    left.src === right.src &&
    left.asset?.id === right.asset?.id &&
    left.asset?.kind === right.asset?.kind &&
    left.tileSize === right.tileSize &&
    left.cols === right.cols &&
    left.rows === right.rows;
}

export function entriesEqual(
  left: readonly TilesetEntry[],
  right: readonly TilesetEntry[]
): boolean {
  return left.length === right.length && left.every((entry, index) => {
    const other = right[index];

    return entry.assetId === other.assetId &&
      entry.label === other.label &&
      definitionsEqual(entry.definition, other.definition);
  });
}
