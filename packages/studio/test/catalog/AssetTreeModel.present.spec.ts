// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { AssetOccupancy } from "../../src/catalog/AssetOccupancy.ts";
import { AssetPath } from "../../src/catalog/AssetPath.ts";
import {
  AssetTreeModel,
  assetNodeId,
  folderNodeId,
  type AssetTreeNode,
  type AssetTreeOverlay
} from "../../src/catalog/AssetTreeModel.ts";
import {
  createCompanionModel,
  shape
} from "../helpers/assetTree.ts";

// CONSTANTS
const kModel = new AssetTreeModel([
  {
    id: "map-1",
    kind: "voxelmap",
    path: "maps/overworld.voxelmap.json"
  },
  {
    id: "map-2",
    kind: "voxelmap",
    path: "maps/cave.voxelmap.json"
  },
  {
    id: "stone",
    kind: "pixelart",
    path: "textures/blocks/stone.pixelart"
  },
  {
    id: "readme",
    kind: "binary",
    path: "README.bin"
  }
]);
const kNoOverlay: AssetTreeOverlay = {
  labels: new Map(),
  rows: new Map(),
  occupancy: AssetOccupancy.EMPTY
};

function badged(
  nodes: readonly AssetTreeNode[]
): string[] {
  return nodes.flatMap((node) => [
    ...(node.badges ?? []).map((badge) => `${node.label}: ${badge.title}`),
    ...badged(node.children ?? [])
  ]);
}

describe("AssetTreeModel.present", () => {
  test("replaces labels without touching the model", () => {
    const labels = new Map([[assetNodeId("map-2"), "tunnel.voxelmap.json"]]);

    assert.deepEqual(shape(kModel.present({ ...kNoOverlay, labels }))[0], [
      "maps",
      ["tunnel.voxelmap.json", "overworld.voxelmap.json"]
    ]);
    assert.equal(kModel.node(assetNodeId("map-2"))?.label, "cave.voxelmap.json");
  });

  test("sorts extra rows into their folder, the root included", () => {
    const rows = new Map([
      [
        folderNodeId(AssetPath.parse("textures/blocks")),
        [{ id: "pending:1", label: "dirt.pixelart" }]
      ],
      [
        folderNodeId(AssetPath.ROOT),
        [{ id: "pending:2", label: "A.bin" }]
      ]
    ]);

    assert.deepEqual(shape(kModel.present({ ...kNoOverlay, rows })), [
      ["maps", ["cave.voxelmap.json", "overworld.voxelmap.json"]],
      ["textures", [["blocks", ["dirt.pixelart", "stone.pixelart"]]]],
      "A.bin",
      "README.bin"
    ]);
  });

  test("badges the open assets, an owner of companions included, never a folder", () => {
    const occupancy = new AssetOccupancy([[
      {
        clientId: "alice",
        displayName: "Alice",
        color: "red"
      },
      { open: ["model-hero", "texture-hero"], focused: "model-hero" }
    ]]);

    const nodes = createCompanionModel().present({
      ...kNoOverlay,
      occupancy
    });

    assert.deepEqual(badged(nodes), [
      "hero.voxelmodel.json: Alice · Editing",
      "hero.pixelart: Alice · Open"
    ]);
  });

  test("returns the model's own nodes when there is nothing to overlay", () => {
    assert.equal(
      kModel.present(kNoOverlay),
      kModel.nodes
    );
  });
});
