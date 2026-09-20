// Import Third-party Dependencies
import {
  AssetSource,
  type AssetRecordData
} from "@jolly-pixel/asset";
import { PIXEL_ART_KIND } from "@jolly-pixel/asset.pixel-art/network/client.ts";
import type { TilesetDefinition } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import type { TilesetEntry } from "../../state/index.ts";

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
