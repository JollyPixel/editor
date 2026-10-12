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
const kModel: AssetRecordData = {
  id: "model-1",
  kind: "voxelmodel",
  source: "maps/hero.voxelmodel.json"
};
const kKinds = new AssetKindSet({
  kinds: [
    {
      kind: "voxelmap",
      label: "Voxel map",
      extension: ".voxelmap.json"
    },
    {
      kind: "voxelmodel",
      label: "Voxel model",
      extension: ".voxelmodel.json",
      convertsFrom: [".vox"]
    },
    {
      kind: "pixelart",
      label: "Pixel art",
      extension: ".pixelart",
      convertsFrom: [".png"]
    }
  ],
  editable: ["voxelmap", "voxelmodel"]
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

function kindFilters(
  view: AssetTreeView
): string[] {
  return view.kindOptions.map((option) => option.value);
}

describe("AssetTreeView", () => {
  test("offers a kind filter only while the kind has assets or is the active filter", () => {
    const catalog = new FakeTreeCatalog([kMap], ["maps"]);
    const { view } = treeView(catalog);
    assert.deepEqual(kindFilters(view), ["", "voxelmap"]);

    catalog.byId.set(kModel.id, kModel);
    catalog.change();
    view.refresh();
    assert.deepEqual(kindFilters(view), ["", "voxelmap", "voxelmodel"]);

    view.filter("voxelmodel");
    catalog.byId.delete(kModel.id);
    catalog.change();
    view.refresh();
    assert.deepEqual(kindFilters(view), ["", "voxelmap", "voxelmodel"]);

    view.filter("");
    view.refresh();
    assert.deepEqual(kindFilters(view), ["", "voxelmap"]);
  });

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

  test("asks once per convertible format and adds the dropped files in the folder", async() => {
    const catalog = new FakeTreeCatalog([kMap], ["maps"]);
    const { view, errors } = treeView(catalog);
    const asked: string[] = [];

    await view.importFiles(AssetPath.parse("maps"), [
      new File(["png"], "hero.png"),
      new File(["png"], "tiles.png"),
      new File(["vox"], "tree.vox"),
      new File(["txt"], "notes.txt"),
      new File(["zip"], "photos.zip")
    ], {
      conversion: async(group) => {
        asked.push(group.format);

        return group.format === ".png" ?
          { convertTo: kKinds.entryOf("pixelart") ?? null } :
          null;
      },
      conflicts: async() => null
    });
    catalog.change();

    assert.deepEqual(asked, [".png", ".vox"]);
    assert.deepEqual(
      [...catalog.records()].map((record) => record.source).sort(),
      [
        "maps/hero.pixelart",
        "maps/notes.txt",
        "maps/overworld.voxelmap.json",
        "maps/photos.zip",
        "maps/tiles.pixelart"
      ]
    );
    assert.ok(view.expanded.has(folderNodeId(AssetPath.parse("maps"))));
    assert.deepEqual(errors, []);
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
