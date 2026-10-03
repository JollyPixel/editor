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
import {
  COMPANION_EDGES,
  COMPANION_RECORDS,
  companionModelOf,
  dependenciesOf,
  shape
} from "../helpers/assetTree.ts";

// CONSTANTS
const kMaps = folderNodeId(AssetPath.parse("maps"));

function nestedUnder(
  model: AssetTreeModel,
  assetId: string
): unknown[] {
  return shape(model.node(assetNodeId(assetId))?.children ?? []);
}

describe("AssetTreeModel companions", () => {
  test("nests an asset under the same-named asset that references it", () => {
    assert.deepEqual(shape(companionModelOf().nodes), [
      ["maps", [
        "cave.voxelmap.json",
        ["overworld.voxelmap.json", ["overworld.tileset.json"]]
      ]],
      ["models", [
        "hero.bin",
        ["hero.voxelmodel.json", ["hero.pixelart"]]
      ]]
    ]);
  });

  test("keeps an owner's companions shown, with no expand toggle", () => {
    const model = companionModelOf();

    assert.equal(model.node(assetNodeId("map-overworld"))?.collapsible, false);
    assert.equal(model.node(assetNodeId("map-cave"))?.collapsible, undefined);
  });

  test("nests nothing without dependencies", () => {
    const model = new AssetTreeModel(COMPANION_RECORDS);

    assert.deepEqual(nestedUnder(model, "map-overworld"), []);
  });

  test("nests nothing across folders", () => {
    const model = companionModelOf([
      {
        id: "map-overworld",
        kind: "voxelmap",
        source: "maps/overworld.voxelmap.json"
      },
      {
        id: "tileset-overworld",
        kind: "tileset",
        source: "tilesets/overworld.tileset.json"
      }
    ]);

    assert.deepEqual(nestedUnder(model, "map-overworld"), []);
  });

  test("nests nothing when two same-named assets reference it", () => {
    const records: AssetRecordData[] = [
      ...COMPANION_RECORDS,
      {
        id: "model-overworld",
        kind: "voxelmodel",
        source: "maps/overworld.voxelmodel.json"
      }
    ];
    const model = companionModelOf(records, {
      ...COMPANION_EDGES,
      "model-overworld": ["tileset-overworld"]
    });

    assert.deepEqual(nestedUnder(model, "map-overworld"), []);
    assert.deepEqual(nestedUnder(model, "model-overworld"), []);
  });

  test("nests nothing for assets referencing each other", () => {
    const model = companionModelOf(COMPANION_RECORDS, {
      "map-overworld": ["tileset-overworld"],
      "tileset-overworld": ["map-overworld"]
    });

    assert.deepEqual(nestedUnder(model, "map-overworld"), []);
    assert.deepEqual(nestedUnder(model, "tileset-overworld"), []);
  });

  test("shows a companion in its folder when the kind filter hides its owner", () => {
    const model = new AssetTreeModel(COMPANION_RECORDS, {
      kind: "tileset",
      dependencies: dependenciesOf(COMPANION_EDGES)
    });

    assert.deepEqual(shape(model.nodes), [
      ["maps", ["overworld.tileset.json"]],
      ["models", []]
    ]);
  });

  test("keeps a companion of another kind under its shown owner", () => {
    const model = new AssetTreeModel(COMPANION_RECORDS, {
      kind: "voxelmodel",
      dependencies: dependenciesOf(COMPANION_EDGES)
    });

    assert.deepEqual(shape(model.nodes), [
      ["maps", []],
      ["models", [["hero.voxelmodel.json", ["hero.pixelart"]]]]
    ]);
  });

  test("renames companions with their owner, keeping their extensions", () => {
    assert.deepEqual(
      companionModelOf().renameOf(assetNodeId("map-overworld"), "island")?.renames,
      [
        {
          assetId: "map-overworld",
          to: "maps/island.voxelmap.json"
        },
        {
          assetId: "tileset-overworld",
          to: "maps/island.tileset.json"
        }
      ]
    );
  });

  test("renames a companion alone", () => {
    assert.deepEqual(
      companionModelOf().renameOf(assetNodeId("texture-hero"), "skin")?.renames,
      [
        {
          assetId: "texture-hero",
          to: "models/skin.pixelart"
        }
      ]
    );
  });

  test("moves companions with their owner, once when both are moved", () => {
    const moves = companionModelOf().movesOf({
      movedIds: [assetNodeId("texture-hero"), assetNodeId("model-hero")],
      targetId: kMaps,
      where: "inside"
    });

    assert.deepEqual(moves.map((relocation) => relocation.renames), [
      [
        {
          assetId: "model-hero",
          to: "maps/hero.voxelmodel.json"
        },
        {
          assetId: "texture-hero",
          to: "maps/hero.pixelart"
        }
      ]
    ]);
  });

  test("refuses a rename whose companion lands on a taken path", () => {
    const model = companionModelOf([
      ...COMPANION_RECORDS,
      {
        id: "tileset-island",
        kind: "tileset",
        source: "maps/island.tileset.json"
      }
    ]);

    assert.throws(
      () => model.renameOf(assetNodeId("map-overworld"), "island"),
      (error) => error instanceof AssetPathTakenError &&
        error.path === "maps/island.tileset.json"
    );
  });
});
