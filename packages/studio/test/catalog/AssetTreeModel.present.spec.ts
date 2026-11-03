// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { AssetPath } from "../../src/catalog/AssetPath.ts";
import {
  AssetTreeModel,
  assetNodeId,
  folderNodeId
} from "../../src/catalog/AssetTreeModel.ts";
import { shape } from "../helpers/assetTree.ts";

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

describe("AssetTreeModel.present", () => {
  test("replaces labels without touching the model", () => {
    const labels = new Map([[assetNodeId("map-2"), "tunnel.voxelmap.json"]]);

    assert.deepEqual(shape(kModel.present({ labels, rows: new Map() }))[0], [
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

    assert.deepEqual(shape(kModel.present({ labels: new Map(), rows })), [
      ["maps", ["cave.voxelmap.json", "overworld.voxelmap.json"]],
      ["textures", [["blocks", ["dirt.pixelart", "stone.pixelart"]]]],
      "A.bin",
      "README.bin"
    ]);
  });

  test("returns the model's own nodes when there is nothing to overlay", () => {
    assert.equal(
      kModel.present({ labels: new Map(), rows: new Map() }),
      kModel.nodes
    );
  });
});
