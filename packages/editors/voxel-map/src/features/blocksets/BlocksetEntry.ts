// Import Third-party Dependencies
import {
  AssetSource,
  type AssetRecordData
} from "@jolly-pixel/asset";
import { BLOCKSET_KIND } from "@jolly-pixel/asset.voxel-map/client";
import type { BlocksetDefinition } from "@jolly-pixel/voxel.renderer";

export class BlocksetEntry {
  static isBlocksetAsset(
    record: AssetRecordData
  ): boolean {
    return record.kind === BLOCKSET_KIND;
  }

  static resolveAll(
    definitions: Iterable<BlocksetDefinition>,
    records: Iterable<AssetRecordData>
  ): BlocksetEntry[] {
    const blocksetRecords = new Map(
      [...records]
        .filter(BlocksetEntry.isBlocksetAsset)
        .map((record) => [record.id, record])
    );

    return [...definitions].map((definition) => {
      const assetId = definition.asset?.id;
      const record = assetId === undefined ?
        undefined :
        blocksetRecords.get(assetId);

      return new BlocksetEntry(
        definition,
        record?.id ?? null,
        record === undefined ?
          definition.id :
          new AssetSource(record.source).name
      );
    });
  }

  static sameDefinition(
    left: BlocksetDefinition,
    right: BlocksetDefinition
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

  readonly definition: BlocksetDefinition;
  readonly assetId: string | null;
  readonly label: string;

  constructor(
    definition: BlocksetDefinition,
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
    other: BlocksetEntry
  ): boolean {
    return this.assetId === other.assetId &&
      this.label === other.label &&
      BlocksetEntry.sameDefinition(this.definition, other.definition);
  }
}
