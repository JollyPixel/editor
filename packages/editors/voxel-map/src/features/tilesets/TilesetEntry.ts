// Import Third-party Dependencies
import {
  AssetSource,
  type AssetRecordData
} from "@jolly-pixel/asset";
import { TILESET_KIND } from "@jolly-pixel/asset.voxel-map/client";
import type { TilesetDefinition } from "@jolly-pixel/voxel.renderer";

export class TilesetEntry {
  static isTilesetAsset(
    record: AssetRecordData
  ): boolean {
    return record.kind === TILESET_KIND;
  }

  static resolveAll(
    definitions: Iterable<TilesetDefinition>,
    records: Iterable<AssetRecordData>
  ): TilesetEntry[] {
    const tilesetRecords = new Map(
      [...records]
        .filter(TilesetEntry.isTilesetAsset)
        .map((record) => [record.id, record])
    );

    return [...definitions].map((definition) => {
      const assetId = definition.asset?.id;
      const record = assetId === undefined ?
        undefined :
        tilesetRecords.get(assetId);

      return new TilesetEntry(
        definition,
        record?.id ?? null,
        record === undefined ?
          definition.id :
          new AssetSource(record.source).name
      );
    });
  }

  static sameDefinition(
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

  readonly definition: TilesetDefinition;
  readonly assetId: string | null;
  readonly label: string;

  constructor(
    definition: TilesetDefinition,
    assetId: string | null,
    label: string
  ) {
    this.definition = definition;
    this.assetId = assetId;
    this.label = label;

    Object.freeze(this);
  }

  get id(): string {
    return this.definition.id;
  }

  get linked(): boolean {
    return this.assetId !== null;
  }

  equals(
    other: TilesetEntry
  ): boolean {
    return this.assetId === other.assetId &&
      this.label === other.label &&
      TilesetEntry.sameDefinition(this.definition, other.definition);
  }
}
