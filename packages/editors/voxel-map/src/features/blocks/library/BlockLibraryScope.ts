// Import Third-party Dependencies
import type { ResolvedBlockDefinition } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import type { BlocksetEntry } from "../../blocksets/BlocksetEntry.ts";
import { BlockLibraryOption } from "./BlockLibraryOption.ts";

export type BlockLibraryScopeKind = "all" | "active";

export class BlockLibraryScope
  extends BlockLibraryOption<BlockLibraryScopeKind> {
  static readonly All = new BlockLibraryScope(
    "all",
    "blocks",
    "All blocksets"
  );

  static readonly Active = new BlockLibraryScope(
    "active",
    "blockset",
    "Active blockset"
  );

  static readonly all: readonly BlockLibraryScope[] = [
    BlockLibraryScope.All,
    BlockLibraryScope.Active
  ];

  static parse(
    value: string | null
  ): BlockLibraryScope {
    return BlockLibraryScope.all.find((scope) => scope.value === value) ??
      BlockLibraryScope.All;
  }

  includes(
    block: ResolvedBlockDefinition,
    active: BlocksetEntry | undefined
  ): boolean {
    return this.value === "all" ||
      active === undefined ||
      active.ownsBlockId(block.id);
  }
}
