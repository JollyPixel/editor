// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { AssetPath } from "../../../src/catalog/AssetPath.ts";
import {
  assetNodeId,
  folderNodeId
} from "../../../src/catalog/AssetTreeModel.ts";
import {
  FakeTreeCatalog,
  findLabel,
  pendingRows
} from "../../helpers/assetTree.ts";
import {
  MAP_RECORD,
  treeView
} from "../../helpers/assetTreeView.ts";

describe("AssetTreeView drafts", () => {
  test("creates a new asset only once its draft row is named", async() => {
    const catalog = new FakeTreeCatalog([MAP_RECORD], ["maps"]);
    const { view, created, revealed } = treeView(catalog);

    view.createAsset("voxelmap", AssetPath.parse("maps"));
    const [draftId] = created;
    const draft = findLabel(view.nodes, draftId);
    const listedWhileNaming = catalog.byId.size;

    await view.endRename(draftId, "world");
    catalog.change();
    view.refresh();

    assert.equal(draft, "New voxel map.voxelmap.json");
    assert.equal(listedWhileNaming, 1);
    assert.ok(view.expanded.includes(folderNodeId(AssetPath.parse("maps"))));
    assert.equal(catalog.byId.get("created-1")?.path, "maps/world.voxelmap.json");
    assert.deepEqual(revealed, [assetNodeId("created-1")]);
    assert.deepEqual(view.selected, [assetNodeId("created-1")]);
    assert.deepEqual(pendingRows(view.nodes), []);
  });

  test("drops a draft row whose naming is cancelled, creating nothing", async() => {
    const catalog = new FakeTreeCatalog([MAP_RECORD], ["maps"]);
    const { view, created } = treeView(catalog);

    view.createAsset("voxelmap", AssetPath.parse("maps"));
    await view.endRename(created[0], null);
    catalog.change();
    view.refresh();

    assert.equal(findLabel(view.nodes, created[0]), undefined);
    assert.equal(catalog.byId.size, 1);
  });
});
