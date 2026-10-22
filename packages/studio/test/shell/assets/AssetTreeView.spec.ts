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
import { BrowserState } from "../../../src/browser/BrowserState.ts";
import { AssetTreeView } from "../../../src/shell/assets/AssetTreeView.ts";
import {
  FakeTreeCatalog,
  findLabel
} from "../../helpers/assetTree.ts";

// CONSTANTS
const kMap: AssetRecordData = {
  id: "map-1",
  kind: "voxelmap",
  path: "maps/overworld.voxelmap.json"
};
const kModel: AssetRecordData = {
  id: "model-1",
  kind: "voxelmodel",
  path: "maps/hero.voxelmodel.json"
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
  browserState: BrowserState;
  errors: string[];
  created: string[];
  prompted: string[];
}

function treeView(
  catalog: FakeTreeCatalog,
  sharing = false
): TreeViewProbe {
  const browserState = new BrowserState(new MemoryStorageAdapter());
  const errors: string[] = [];
  const created: string[] = [];
  const prompted: string[] = [];
  const view = new AssetTreeView({
    catalog,
    kinds: kKinds,
    browserState,
    prompts: {
      open: (assetId) => prompted.push(`open ${assetId}`),
      rename: (nodeId) => prompted.push(`rename ${nodeId}`),
      share: sharing ?
        (asset) => prompted.push(`share ${asset.id}`) :
        null,
      confirmDelete: async() => {
        prompted.push("confirm delete");

        return null;
      }
    },
    onChange: () => undefined,
    onError: (message) => errors.push(message),
    onCreated: (nodeId) => created.push(nodeId)
  });

  return {
    view,
    browserState,
    errors,
    created,
    prompted
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
    const before = findLabel(view.nodes, nodeId);

    const renaming = view.rename(nodeId, "world");
    const during = findLabel(view.nodes, nodeId);
    await renaming;

    assert.notEqual(during, before);
    assert.equal(findLabel(view.nodes, nodeId), before);
    assert.equal(errors.length, 1);
  });

  test("keeps a renamed folder expanded and selected under its new path", async() => {
    const catalog = new FakeTreeCatalog([kMap], ["maps"]);
    const { view, browserState } = treeView(catalog);
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
    assert.ok(browserState.expandedFolders.has(world));
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
          { convertTo: kKinds.findEntry("pixelart") ?? null } :
          null;
      },
      conflicts: async() => null
    });
    catalog.change();

    assert.deepEqual(asked, [".png", ".vox"]);
    assert.deepEqual(
      [...catalog.records()].map((record) => record.path).sort(),
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

describe("AssetTreeView actions", () => {
  test("offers share only when the studio can share, and only on one asset", () => {
    const catalog = new FakeTreeCatalog([kMap], ["maps"]);
    const maps = folderNodeId(AssetPath.parse("maps"));
    const map = assetNodeId(kMap.id);
    const offline = treeView(catalog);
    const online = treeView(catalog, true);

    offline.view.run("share", [map]);
    online.view.run("share", [maps]);
    online.view.run("share", [map]);

    assert.deepEqual(
      [offline.view.allows("share", [map]), online.view.allows("share", [maps])],
      [false, false]
    );
    assert.deepEqual(offline.prompted, []);
    assert.deepEqual(online.prompted, [`share ${kMap.id}`]);
  });

  test("opens and renames through the page's prompts, rename on one row only", () => {
    const catalog = new FakeTreeCatalog([kMap, kModel], ["maps"]);
    const { view, prompted } = treeView(catalog);
    const map = assetNodeId(kMap.id);
    const model = assetNodeId(kModel.id);

    view.run("open", [map]);
    view.run("rename", [map, model]);
    view.select([model]);
    view.run("rename");

    assert.deepEqual(prompted, [`open ${kMap.id}`, `rename ${model}`]);
  });
});
