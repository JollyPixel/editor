// Import Third-party Dependencies
import type { ResolvedBlockDefinition } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import { BlockLibraryOption } from "./BlockLibraryOption.ts";

export type BlockLibraryOrderKind = "registry" | "usage";

export class BlockLibraryOrder
  extends BlockLibraryOption<BlockLibraryOrderKind> {
  static readonly Registry = new BlockLibraryOrder(
    "registry",
    "order-registry",
    "Library order"
  );

  static readonly Usage = new BlockLibraryOrder(
    "usage",
    "order-usage",
    "Most used first"
  );

  static readonly all: readonly BlockLibraryOrder[] = [
    BlockLibraryOrder.Registry,
    BlockLibraryOrder.Usage
  ];

  static parse(
    value: string | null
  ): BlockLibraryOrder {
    return BlockLibraryOrder.all.find((order) => order.value === value) ??
      BlockLibraryOrder.Registry;
  }

  get reorderable(): boolean {
    return this.value === "registry";
  }

  apply(
    blocks: ResolvedBlockDefinition[],
    counts: ReadonlyMap<number, number>
  ): ResolvedBlockDefinition[] {
    if (this.value === "registry") {
      return blocks;
    }

    return blocks
      .map((block, index) => {
        return {
          block,
          index,
          count: counts.get(block.id) ?? 0
        };
      })
      .sort((a, b) => b.count - a.count || a.index - b.index)
      .map(({ block }) => block);
  }
}
