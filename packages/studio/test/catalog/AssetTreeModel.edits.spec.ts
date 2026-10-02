// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type { AssetRecordData } from "@jolly-pixel/asset";

// Import Internal Dependencies
import { AssetPath } from "../../src/catalog/AssetPath.ts";
import {
  AssetTreeModel,
  assetNodeId,
  folderNodeId
} from "../../src/catalog/AssetTreeModel.ts";
import { AssetPathTakenError } from "../../src/catalog/errors/AssetPathTakenError.ts";
import { shape } from "../helpers/assetTree.ts";

// CONSTANTS
const kRecords: AssetRecordData[] = [
  {
    id: "map-1",
    kind: "voxelmap",
    source: "maps/overworld.voxelmap.json"
  },
  {
    id: "tex-1",
    kind: "pixelart",
    source: "textures/stone.pixelart"
  },
  {
    id: "tex-2",
    kind: "pixelart",
    source: "textures/old/stone.pixelart"
  },
  {
    id: "readme",
    kind: "binary",
    source: "README.bin"
  }
];
const kModel = new AssetTreeModel(kRecords);
const kMaps = folderNodeId(AssetPath.parse("maps"));
const kTextures = folderNodeId(AssetPath.parse("textures"));

describe("AssetTreeModel draft folders", () => {
  test("shows an empty folder, whatever the kind filter", () => {
    const model = new AssetTreeModel(kRecords, {
      kind: "voxelmap",
      folders: [AssetPath.parse("maps/caves/deep")]
    });

    assert.deepEqual(shape(model.nodes), [
      ["maps", [["caves", [["deep", []]]], "overworld.voxelmap.json"]]
    ]);
    assert.equal(
      model.dropFolder({
        targetId: folderNodeId(AssetPath.parse("maps/caves/deep")),
        where: "inside"
      })?.toString(),
      "maps/caves/deep"
    );
  });

  test("renames an empty folder without asset renames", () => {
    const model = new AssetTreeModel(kRecords, {
      folders: [AssetPath.parse("drafts")]
    });
    const relocation = model.renameOf(folderNodeId(AssetPath.parse("drafts")), "levels");

    assert.equal(relocation?.to.toString(), "levels");
    assert.deepEqual(relocation?.renames, []);
  });

  test("names a new folder after a path no folder, asset or hidden asset holds", () => {
    const model = new AssetTreeModel(kRecords, {
      kind: "voxelmap",
      folders: [AssetPath.parse("New folder")]
    });

    for (const [name, vacant] of [
      ["New folder", "New folder 2"],
      ["maps", "maps 2"],
      ["README.bin", "README.bin 2"],
      ["textures", "textures 2"],
      ["levels", "levels"]
    ]) {
      assert.equal(model.vacantFolder(AssetPath.ROOT, name).toString(), vacant);
    }
    assert.equal(
      model.vacantFolder(AssetPath.parse("maps"), "New folder").toString(),
      "maps/New folder"
    );
  });
});

describe("AssetTreeModel moves of several rows", () => {
  test("moves each selected asset into the target folder", () => {
    const moves = kModel.movesOf({
      movedIds: [assetNodeId("readme"), assetNodeId("tex-1")],
      targetId: kMaps,
      where: "inside"
    });

    assert.deepEqual(moves.map((relocation) => relocation.renames), [
      [{ assetId: "readme", to: "maps/README.bin" }],
      [{ assetId: "tex-1", to: "maps/stone.pixelart" }]
    ]);
  });

  test("refuses the whole move when two assets land on one path", () => {
    assert.throws(
      () => kModel.movesOf({
        movedIds: [assetNodeId("tex-1"), assetNodeId("tex-2")],
        targetId: kMaps,
        where: "inside"
      }),
      (error) => error instanceof AssetPathTakenError &&
        error.path === "maps/stone.pixelart"
    );
  });

  test("refuses a move onto an asset that stays", () => {
    assert.throws(
      () => kModel.movesOf({
        movedIds: [assetNodeId("tex-2")],
        targetId: kTextures,
        where: "inside"
      }),
      AssetPathTakenError
    );
  });

  test("merges a renamed folder into another when no path collides", () => {
    assert.deepEqual(kModel.renameOf(kMaps, "textures")?.renames, [
      {
        assetId: "map-1",
        to: "textures/overworld.voxelmap.json"
      }
    ]);
  });
});
