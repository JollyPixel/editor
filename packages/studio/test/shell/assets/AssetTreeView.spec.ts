// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type { AssetRecordData } from "@jolly-pixel/asset";
import { MemoryStorageAdapter } from "@jolly-pixel/ui";

// Import Internal Dependencies
import { AssetKindSet } from "../../../src/catalog/AssetKindSet.ts";
import { AssetPath } from "../../../src/catalog/AssetPath.ts";
import {
  assetNodeId,
  folderNodeId
} from "../../../src/catalog/AssetTreeModel.ts";
import { StudioPreferences } from "../../../src/preferences/StudioPreferences.ts";
import { AssetTreeView } from "../../../src/shell/assets/AssetTreeView.ts";
import {
  FakeTreeCatalog,
  labelOf
} from "../../helpers/assetTree.ts";

// CONSTANTS
const kMap: AssetRecordData = {
  id: "map-1",
  kind: "voxelmap",
  source: "maps/overworld.voxelmap.json"
};
const kKinds = new AssetKindSet({
  kinds: [
    {
      kind: "voxelmap",
      label: "Voxel map",
      extension: ".voxelmap.json"
    }
  ],
  editable: ["voxelmap"]
});

interface TreeViewProbe {
  view: AssetTreeView;
  preferences: StudioPreferences;
  errors: string[];
  created: string[];
}

function treeView(
  catalog: FakeTreeCatalog
): TreeViewProbe {
  const preferences = new StudioPreferences(new MemoryStorageAdapter());
  const errors: string[] = [];
  const created: string[] = [];
  const view = new AssetTreeView({
    catalog,
    kinds: kKinds,
    preferences,
    onChange: () => undefined,
    onError: (message) => errors.push(message),
    onCreated: (nodeId) => created.push(nodeId)
  });

  return {
    view,
    preferences,
    errors,
    created
  };
}

describe("AssetTreeView", () => {
  test("shows a new name while renaming and the old one again when the rename fails", async() => {
    const catalog = new FakeTreeCatalog([kMap], ["maps"]);
    catalog.failure = "disk full";
    const { view, errors } = treeView(catalog);
    const nodeId = assetNodeId(kMap.id);
    const before = labelOf(view.nodes, nodeId);

    const renaming = view.rename(nodeId, "world");
    const during = labelOf(view.nodes, nodeId);
    await renaming;

    assert.notEqual(during, before);
    assert.equal(labelOf(view.nodes, nodeId), before);
    assert.equal(errors.length, 1);
  });

  test("keeps a renamed folder expanded and selected under its new path", async() => {
    const catalog = new FakeTreeCatalog([kMap], ["maps"]);
    const { view, preferences } = treeView(catalog);
    const maps = folderNodeId(AssetPath.parse("maps"));
    const world = folderNodeId(AssetPath.parse("world"));
    view.toggle(maps, true);
    view.select([maps]);

    await view.rename(maps, "world");
    catalog.change();
    view.refresh();

    assert.ok(view.model.has(world));
    assert.ok(view.expanded.has(world));
    assert.deepEqual(view.selected, [world]);
    assert.ok(preferences.expandedFolders.has(world));
  });

  test("selects a new asset and asks to rename it once the catalog lists it", async() => {
    const catalog = new FakeTreeCatalog([kMap], ["maps"]);
    const { view, created } = treeView(catalog);

    await view.createAsset("voxelmap", AssetPath.parse("maps"));
    view.refresh();
    const beforeEcho = [...created];
    catalog.change();
    view.refresh();

    const [assetId] = [...catalog.byId.keys()].filter((id) => id !== kMap.id);
    assert.ok(assetId !== undefined);
    assert.deepEqual(beforeEcho, []);
    assert.deepEqual(created, [assetNodeId(assetId)]);
    assert.deepEqual(view.selected, [assetNodeId(assetId)]);
    assert.ok(view.expanded.has(folderNodeId(AssetPath.parse("maps"))));
  });
});
