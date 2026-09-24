// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type { AssetRecordData } from "@jolly-pixel/asset";

// Import Internal Dependencies
import { AssetPath } from "../src/catalog/AssetPath.ts";
import {
  AssetTreeModel,
  assetNodeId,
  folderNodeId,
  type AssetRelocation,
  type AssetTreeNode
} from "../src/catalog/AssetTreeModel.ts";
import { InvalidAssetNameError } from "../src/catalog/errors/InvalidAssetNameError.ts";

// CONSTANTS
const kRecords: AssetRecordData[] = [
  {
    id: "tex-b",
    kind: "pixelart",
    source: "textures/b.pixelart"
  },
  {
    id: "map-1",
    kind: "voxelmap",
    source: "maps/overworld.voxelmap.json"
  },
  {
    id: "readme",
    kind: "binary",
    source: "README.bin"
  },
  {
    id: "tex-a",
    kind: "pixelart",
    source: "textures/A.pixelart"
  },
  {
    id: "tex-nested",
    kind: "pixelart",
    source: "textures/blocks/stone.pixelart"
  },
  {
    id: "map-2",
    kind: "voxelmap",
    source: "maps/cave.voxelmap.json"
  }
];
const kModel = new AssetTreeModel(kRecords);
const kMaps = folderNodeId(AssetPath.parse("maps"));
const kTextures = folderNodeId(AssetPath.parse("textures"));
const kBlocks = folderNodeId(AssetPath.parse("textures/blocks"));

function shape(
  nodes: AssetTreeNode[]
): unknown[] {
  return nodes.map((node) => (
    node.children === undefined ?
      node.label :
      [node.label, shape(node.children)]
  ));
}

function plain(
  relocation: AssetRelocation | null
): unknown {
  return relocation === null ?
    null :
    {
      nodeId: relocation.nodeId,
      from: relocation.from.toString(),
      to: relocation.to.toString(),
      renames: relocation.renames
    };
}

describe("AssetTreeModel", () => {
  test("groups records into path prefix folders, folders first, sorted", () => {
    assert.deepEqual(shape(kModel.nodes), [
      ["maps", ["cave.voxelmap.json", "overworld.voxelmap.json"]],
      ["textures", [["blocks", ["stone.pixelart"]], "A.pixelart", "b.pixelart"]],
      "README.bin"
    ]);
  });

  test("gives stable ids, renamable rows and data to folders and assets", () => {
    const maps = kModel.node(kMaps);
    assert.equal(maps?.icon, "folder");
    assert.equal(maps?.renamable, true);
    assert.equal(maps?.data?.type, "folder");
    assert.equal(maps?.data?.path.toString(), "maps");

    const cave = kModel.node(assetNodeId("map-2"));
    assert.equal(cave?.renamable, true);
    assert.equal(cave?.children, undefined);
    assert.deepEqual(cave?.data?.type === "asset" && {
      id: cave.data.id,
      kind: cave.data.kind,
      path: cave.data.path.toString()
    }, {
      id: "map-2",
      kind: "voxelmap",
      path: "maps/cave.voxelmap.json"
    });
  });

  test("resolves icons and details per kind", () => {
    const model = new AssetTreeModel(kRecords, {
      iconFor: (kind) => (kind === "voxelmap" ? "map" : undefined),
      detailFor: (kind) => (kind === "binary" ? "no editor" : undefined)
    });

    assert.equal(model.node(assetNodeId("map-1"))?.icon, "map");
    assert.equal(model.node(assetNodeId("readme"))?.icon, undefined);
    assert.equal(model.node(assetNodeId("readme"))?.detail, "no editor");
    assert.equal(model.node(assetNodeId("map-1"))?.detail, undefined);
  });

  test("lists every folder id depth first", () => {
    assert.deepEqual(kModel.folderIds(), [kMaps, kTextures, kBlocks]);
  });

  test("is empty for no records", () => {
    assert.deepEqual(AssetTreeModel.EMPTY.nodes, []);
    assert.deepEqual(AssetTreeModel.EMPTY.folderIds(), []);
  });

  test("lists the asset itself or every asset under a folder", () => {
    assert.deepEqual(
      kModel.assetsUnder(assetNodeId("readme")).map((asset) => asset.id),
      ["readme"]
    );
    assert.deepEqual(
      kModel.assetsUnder(kTextures).map((asset) => asset.id),
      ["tex-b", "tex-a", "tex-nested"]
    );
    assert.deepEqual(kModel.assetsUnder("asset:unknown"), []);
  });

  test("replaces labels without touching the model", () => {
    const labels = new Map([[assetNodeId("map-2"), "tunnel.voxelmap.json"]]);

    assert.deepEqual(shape(kModel.withLabels(labels))[0], [
      "maps",
      ["tunnel.voxelmap.json", "overworld.voxelmap.json"]
    ]);
    assert.equal(kModel.node(assetNodeId("map-2"))?.label, "cave.voxelmap.json");
    assert.equal(kModel.withLabels(new Map()), kModel.nodes);
  });
});

describe("AssetTreeModel.renameOf", () => {
  test("renames an asset in its folder and keeps its extension", () => {
    assert.deepEqual(plain(kModel.renameOf(assetNodeId("map-2"), "tunnel")), {
      nodeId: assetNodeId("map-2"),
      from: "maps/cave.voxelmap.json",
      to: "maps/tunnel.voxelmap.json",
      renames: [
        {
          assetId: "map-2",
          to: "maps/tunnel.voxelmap.json"
        }
      ]
    });
  });

  test("renames every asset under a folder, nested ones included", () => {
    assert.deepEqual(kModel.renameOf(kTextures, "art")?.renames, [
      {
        assetId: "tex-b",
        to: "art/b.pixelart"
      },
      {
        assetId: "tex-a",
        to: "art/A.pixelart"
      },
      {
        assetId: "tex-nested",
        to: "art/blocks/stone.pixelart"
      }
    ]);
  });

  test("ignores siblings sharing the folder name as a prefix", () => {
    const model = new AssetTreeModel([
      {
        id: "inside",
        kind: "binary",
        source: "map/a.bin"
      },
      {
        id: "outside",
        kind: "binary",
        source: "maps/b.bin"
      }
    ]);

    assert.deepEqual(model.renameOf(folderNodeId(AssetPath.parse("map")), "world")?.renames, [
      {
        assetId: "inside",
        to: "world/a.bin"
      }
    ]);
  });

  test("returns null for an unknown node or an unchanged path", () => {
    assert.equal(kModel.renameOf("asset:unknown", "x"), null);
    assert.equal(kModel.renameOf(assetNodeId("map-2"), "cave"), null);
  });

  test("throws for an invalid name", () => {
    assert.throws(() => kModel.renameOf(kMaps, "a/b"), InvalidAssetNameError);
  });
});

describe("AssetTreeModel drops", () => {
  test("lands inside a folder, or in the folder of an above/below target", () => {
    assert.equal(kModel.dropFolder({ targetId: kTextures, where: "inside" })?.toString(), "textures");
    assert.equal(kModel.dropFolder({ targetId: kBlocks, where: "below" })?.toString(), "textures");
    assert.equal(kModel.dropFolder({ targetId: assetNodeId("readme"), where: "above" })?.isRoot, true);
    assert.equal(kModel.dropFolder({ targetId: assetNodeId("map-1"), where: "inside" }), null);
  });

  test("accepts a move to another folder only", () => {
    const readme = assetNodeId("readme");

    assert.equal(kModel.acceptsDrop({ movedIds: [readme], targetId: kMaps, where: "inside" }), true);
    assert.equal(kModel.acceptsDrop({ movedIds: [readme], targetId: kMaps, where: "below" }), false);
    assert.equal(kModel.acceptsDrop({
      movedIds: [readme],
      targetId: assetNodeId("map-1"),
      where: "inside"
    }), false);
    assert.equal(kModel.acceptsDrop({ movedIds: [kTextures], targetId: kBlocks, where: "inside" }), false);
  });

  test("moves an asset and a whole folder, keeping nested paths", () => {
    assert.deepEqual(
      kModel.movesOf({ movedIds: [assetNodeId("readme")], targetId: kMaps, where: "inside" }).map(plain),
      [
        {
          nodeId: assetNodeId("readme"),
          from: "README.bin",
          to: "maps/README.bin",
          renames: [{ assetId: "readme", to: "maps/README.bin" }]
        }
      ]
    );
    assert.deepEqual(
      kModel.movesOf({ movedIds: [kBlocks], targetId: kMaps, where: "above" })
        .map((relocation) => relocation.renames),
      [[{ assetId: "tex-nested", to: "blocks/stone.pixelart" }]]
    );
  });

  test("skips a row whose folder moves with it", () => {
    const moves = kModel.movesOf({
      movedIds: [kTextures, assetNodeId("tex-nested")],
      targetId: kMaps,
      where: "inside"
    });

    assert.deepEqual(moves.map((relocation) => relocation.nodeId), [kTextures]);
  });
});
