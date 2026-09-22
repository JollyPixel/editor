// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type { AssetRecordData } from "@jolly-pixel/asset";

// Import Internal Dependencies
import {
  assetIdOf,
  assetName,
  assetNodeId,
  assetTree,
  folderIds,
  folderNodeId,
  folderPathOf,
  folderRenames,
  type AssetTreeNode
} from "../src/catalog/assetTree.ts";

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

function shape(
  nodes: AssetTreeNode[]
): unknown[] {
  return nodes.map((node) => (
    node.children === undefined ?
      node.label :
      [node.label, shape(node.children)]
  ));
}

describe("assetTree", () => {
  test("groups records into path prefix folders, folders first, sorted", () => {
    const nodes = assetTree(kRecords);

    assert.deepEqual(shape(nodes), [
      ["maps", ["cave.voxelmap.json", "overworld.voxelmap.json"]],
      ["textures", [["blocks", ["stone.pixelart"]], "A.pixelart", "b.pixelart"]],
      "README.bin"
    ]);
  });

  test("gives stable ids and data to folders and assets", () => {
    const [maps] = assetTree(kRecords);

    assert.equal(maps.id, folderNodeId("maps"));
    assert.deepEqual(maps.data, {
      type: "folder",
      path: "maps"
    });
    assert.equal(maps.icon, "folder");

    const [cave] = maps.children ?? [];
    assert.equal(cave.id, assetNodeId("map-2"));
    assert.deepEqual(cave.data, {
      type: "asset",
      id: "map-2",
      kind: "voxelmap",
      path: "maps/cave.voxelmap.json"
    });
    assert.equal(cave.children, undefined);
  });

  test("resolves icons and details per kind", () => {
    const nodes = assetTree(kRecords, {
      iconFor: (kind) => (kind === "voxelmap" ? "map" : undefined),
      detailFor: (kind) => (kind === "binary" ? "no editor" : undefined)
    });
    const [maps, , readme] = nodes;

    assert.equal(maps.children?.[0].icon, "map");
    assert.equal(readme.icon, undefined);
    assert.equal(readme.detail, "no editor");
    assert.equal(maps.children?.[0].detail, undefined);
  });

  test("lists every folder id for expansion", () => {
    assert.deepEqual(folderIds(assetTree(kRecords)), [
      folderNodeId("maps"),
      folderNodeId("textures"),
      folderNodeId("textures/blocks")
    ]);
  });

  test("returns an empty tree for no records", () => {
    assert.deepEqual(assetTree([]), []);
  });
});

describe("node ids", () => {
  test("round-trip asset ids and folder paths", () => {
    assert.equal(assetIdOf(assetNodeId("map-1")), "map-1");
    assert.equal(assetIdOf(folderNodeId("maps")), undefined);
    assert.equal(folderPathOf(folderNodeId("a/b")), "a/b");
    assert.equal(folderPathOf(assetNodeId("map-1")), undefined);
  });

  test("assetName keeps the file name of a source path", () => {
    assert.equal(assetName("maps/overworld.voxelmap.json"), "overworld.voxelmap.json");
    assert.equal(assetName("README.bin"), "README.bin");
  });
});

describe("folderRenames", () => {
  test("renames every asset under the folder, nested ones included", () => {
    assert.deepEqual(folderRenames(kRecords, "textures", "art"), [
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
    const records: AssetRecordData[] = [
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
    ];

    assert.deepEqual(folderRenames(records, "map", "world"), [
      {
        assetId: "inside",
        to: "world/a.bin"
      }
    ]);
  });
});
