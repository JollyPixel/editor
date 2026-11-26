// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  CATALOG_CREATE,
  CATALOG_RENAME
} from "@jolly-pixel/asset-server/client";
import type { JollyReparentDetail } from "@jolly-pixel/ui";

// Import Internal Dependencies
import { AssetPath } from "../../../src/catalog/AssetPath.ts";
import {
  assetNodeId,
  folderNodeId
} from "../../../src/catalog/AssetTreeModel.ts";
import { FakeTreeCatalog } from "../../helpers/assetTree.ts";
import {
  MAP_RECORD,
  treeView
} from "../../helpers/assetTreeView.ts";

describe("AssetTreeView rights", () => {
  test("a role without the rename and create rights renames, moves and adds nothing", async() => {
    const catalog = new FakeTreeCatalog([MAP_RECORD], ["maps", "world"]);
    const { view, errors, created } = treeView(catalog);
    const nodeId = assetNodeId(MAP_RECORD.id);
    const maps = AssetPath.parse("maps");
    const intoWorld: JollyReparentDetail = {
      movedIds: [nodeId],
      targetId: folderNodeId(AssetPath.parse("world")),
      where: "inside"
    };
    const movable = view.acceptsDrop(intoWorld);
    catalog.refuse(CATALOG_RENAME, CATALOG_CREATE);

    await view.rename(nodeId, "world");
    view.createAsset("voxelmap", maps);
    await view.importFiles(maps, [new File(["txt"], "notes.txt")], {
      conversion: async() => null,
      conflicts: async() => null
    });
    catalog.change();

    assert.deepEqual(
      [...catalog.records()].map((record) => record.path),
      ["maps/overworld.voxelmap.json"]
    );
    assert.deepEqual(created, []);
    assert.deepEqual(errors, ["Your role cannot add assets to this project"]);
    assert.equal(view.allows("rename", [nodeId]), false);
    assert.deepEqual([movable, view.acceptsDrop(intoWorld)], [true, false]);
  });
});
