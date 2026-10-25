// Import Node.js Dependencies
import assert from "node:assert/strict";
import { describe, it } from "node:test";

// Import Third-party Dependencies
import {
  composeBlockId,
  type BlockProperties,
  type ResolvedBlockDefinition
} from "@jolly-pixel/voxel.renderer";
import { SearchQuery } from "@jolly-pixel/ui";

// Import Internal Dependencies
import { BlocksetEntry } from "../../../../src/viewer/BlocksetEntry.ts";
import { BlockLibraryOrder } from "../../../../src/features/blocks/library/BlockLibraryOrder.ts";
import { BlockLibraryScope } from "../../../../src/features/blocks/library/BlockLibraryScope.ts";
import { BlockLibraryView } from "../../../../src/features/blocks/library/BlockLibraryView.ts";

// CONSTANTS
const kStone = new BlocksetEntry({ id: "stone", slot: 1 }, null, "stone");

function block(
  slot: number,
  localId: number,
  name: string,
  properties: BlockProperties = {}
): ResolvedBlockDefinition {
  return {
    id: composeBlockId(slot, localId),
    name,
    shapeId: "cube",
    faceTextures: {},
    collidable: true,
    properties
  };
}

function names(
  blocks: readonly ResolvedBlockDefinition[]
): string[] {
  return blocks.map(({ name }) => name);
}

describe("BlockLibraryView", () => {
  const registry = [
    block(1, 1, "Stone"),
    block(2, 1, "Oak planks"),
    block(1, 2, "Mossy stone"),
    block(2, 2, "Stone bricks"),
    block(1, 3, "Glass", { stone: true })
  ];
  const noUsage = new Map<number, number>();

  it("shows every block by default", () => {
    assert.deepEqual(
      BlockLibraryView.Default.apply(registry, kStone, noUsage),
      registry
    );
  });

  it("keeps the blocks whose name contains the search, in order", () => {
    const view = BlockLibraryView.Default.with({
      search: new SearchQuery("stone")
    });

    assert.deepEqual(
      names(view.apply(registry, kStone, noUsage)),
      ["Stone", "Mossy stone", "Stone bricks"]
    );
  });

  it("searches within the active blockset and orders the result", () => {
    const view = new BlockLibraryView({
      order: BlockLibraryOrder.Usage,
      scope: BlockLibraryScope.Active,
      search: new SearchQuery("stone")
    });
    const usage = new Map([[registry[2].id, 4]]);

    assert.deepEqual(
      names(view.apply(registry, kStone, usage)),
      ["Mossy stone", "Stone"]
    );
  });

  it("changes one setting and keeps the others", () => {
    const search = new SearchQuery("stone");
    const view = BlockLibraryView.Default
      .with({ search })
      .with({ order: BlockLibraryOrder.Usage });

    assert.equal(view.search, search);
    assert.equal(view.order, BlockLibraryOrder.Usage);
    assert.equal(view.scope, BlockLibraryScope.All);
  });
});
