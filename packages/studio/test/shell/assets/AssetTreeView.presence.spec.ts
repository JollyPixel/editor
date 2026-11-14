// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { OPEN_ASSETS_KEY } from "@jolly-pixel/server";

// Import Internal Dependencies
import { assetNodeId } from "../../../src/catalog/AssetTreeModel.ts";
import { CatalogPresence } from "../../../src/catalog/CatalogPresence.ts";
import {
  FakeTreeCatalog,
  findNode
} from "../../helpers/assetTree.ts";
import { chatRoomHarness } from "../../helpers/chatRoom.ts";
import {
  MAP_RECORD,
  MODEL_RECORD,
  treeView
} from "../../helpers/assetTreeView.ts";

describe("AssetTreeView presence", () => {
  test("badges the row of an asset when a peer opens it", () => {
    const catalog = new FakeTreeCatalog([MAP_RECORD, MODEL_RECORD], ["maps"]);
    const harness = chatRoomHarness();
    using presence = new CatalogPresence(harness.room);
    const { view } = treeView(catalog, { presence });
    const map = assetNodeId(MAP_RECORD.id);
    const model = assetNodeId(MODEL_RECORD.id);
    const before = findNode(view.nodes, map)?.badges;

    harness.addPeer("alice", { username: "Alice" }, {
      [OPEN_ASSETS_KEY]: { open: [MAP_RECORD.id], focused: MAP_RECORD.id }
    });

    assert.equal(before, undefined);
    assert.deepEqual(
      findNode(view.nodes, map)?.badges?.map((badge) => badge.title),
      ["Alice · Editing"]
    );
    assert.equal(findNode(view.nodes, model)?.badges, undefined);
  });
});
