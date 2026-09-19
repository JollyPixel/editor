// Import Third-party Dependencies
import {
  AssetSource,
  type AssetRecordData
} from "@jolly-pixel/asset";
import { PIXEL_ART_KIND } from "@jolly-pixel/asset.pixel-art/network/client.ts";
import type { TilesetDefinition } from "@jolly-pixel/voxel.renderer";

export interface TilesetEntry {
  readonly definition: TilesetDefinition;
  readonly assetId: string | null;
  readonly label: string;
}

export function isTilesetAsset(
  record: AssetRecordData
): boolean {
  return record.kind === PIXEL_ART_KIND;
}

export function resolveTilesetAsset(
  assetId: string,
  records: Iterable<AssetRecordData>
): AssetRecordData | null {
  for (const record of records) {
    if (isTilesetAsset(record) && record.id === assetId) {
      return record;
    }
  }

  return null;
}

export function resolveTilesetEntries(
  definitions: Iterable<TilesetDefinition>,
  records: Iterable<AssetRecordData>
): TilesetEntry[] {
  const known = [...records];

  return [...definitions].map((definition) => {
    const assetId = definition.asset?.id;
    const record = assetId === undefined ?
      null :
      resolveTilesetAsset(assetId, known);

    return {
      definition,
      assetId: record?.id ?? null,
      label: record === null ?
        definition.id :
        new AssetSource(record.source).name
    };
  });
}

export function definitionsEqual(
  left: TilesetDefinition,
  right: TilesetDefinition
): boolean {
  return left.id === right.id &&
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
