// Import Third-party Dependencies
import type { ResolvedBlockDefinition } from "@jolly-pixel/voxel.renderer";
import { SearchQuery } from "@jolly-pixel/ui";

// Import Internal Dependencies
import type { BlocksetEntry } from "../../../viewer/BlocksetEntry.ts";
import { BlockLibraryOrder } from "./BlockLibraryOrder.ts";
import { BlockLibraryScope } from "./BlockLibraryScope.ts";

export interface BlockLibraryViewOptions {
  order: BlockLibraryOrder;
  scope: BlockLibraryScope;
  search: SearchQuery;
}

export class BlockLibraryView {
  static readonly Default = new BlockLibraryView({
    order: BlockLibraryOrder.Registry,
    scope: BlockLibraryScope.All,
    search: SearchQuery.EMPTY
  });

  readonly order: BlockLibraryOrder;
  readonly scope: BlockLibraryScope;
  readonly search: SearchQuery;

  constructor(
    options: BlockLibraryViewOptions
  ) {
    this.order = options.order;
    this.scope = options.scope;
    this.search = options.search;
  }

  with(
    changes: Partial<BlockLibraryViewOptions>
  ): BlockLibraryView {
    return new BlockLibraryView({
      order: changes.order ?? this.order,
      scope: changes.scope ?? this.scope,
      search: changes.search ?? this.search
    });
  }

  apply(
    registry: readonly ResolvedBlockDefinition[],
    active: BlocksetEntry | undefined,
    counts: ReadonlyMap<number, number>
  ): ResolvedBlockDefinition[] {
    const shown = registry.filter(
      (block) => this.scope.includes(block, active) &&
        this.search.matches(block.name)
    );

    return this.order.apply(shown, counts);
  }
}
