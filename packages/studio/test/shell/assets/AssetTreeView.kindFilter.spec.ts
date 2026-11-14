// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { KindFilter } from "@jolly-pixel/server";

// Import Internal Dependencies
import {
  assetNodeId,
  folderNodeId
} from "../../../src/catalog/AssetTreeModel.ts";
import { AssetPath } from "../../../src/catalog/AssetPath.ts";
import type { AssetTreeView } from "../../../src/shell/assets/AssetTreeView.ts";
import type { KindFilterSource } from "../../../src/shell/assets/AssetTreeViewOptions.ts";
import { KIND_FILTER_CHANGE } from "../../../src/project/StudioProjectSettings.ts";
import { FakeTreeCatalog } from "../../helpers/assetTree.ts";
import {
  MAP_RECORD,
  MODEL_RECORD,
  treeView
} from "../../helpers/assetTreeView.ts";

class ProjectKindFilter extends EventTarget implements KindFilterSource {
  kindFilter: KindFilter;

  constructor(
    kindFilter: KindFilter
  ) {
    super();
    this.kindFilter = kindFilter;
  }

  replace(
    kindFilter: KindFilter
  ): void {
    this.kindFilter = kindFilter;
    this.dispatchEvent(new Event(KIND_FILTER_CHANGE));
  }
}

function kindFilters(
  view: AssetTreeView
): string[] {
  return view.kindOptions.map((option) => option.value);
}

function folder(
  path: string
): string {
  return folderNodeId(AssetPath.parse(path));
}

describe("AssetTreeView kind filter", () => {
  test("offers a kind only while it has assets or is the active filter", () => {
    const catalog = new FakeTreeCatalog([MAP_RECORD], ["maps"]);
    const { view } = treeView(catalog);
    assert.deepEqual(kindFilters(view), ["", "voxelmap"]);

    catalog.byId.set(MODEL_RECORD.id, MODEL_RECORD);
    catalog.change();
    view.refresh();
    assert.deepEqual(kindFilters(view), ["", "voxelmap", "voxelmodel"]);

    view.filter("voxelmodel");
    catalog.byId.delete(MODEL_RECORD.id);
    catalog.change();
    view.refresh();
    assert.deepEqual(kindFilters(view), ["", "voxelmap", "voxelmodel"]);

    view.filter("");
    view.refresh();
    assert.deepEqual(kindFilters(view), ["", "voxelmap"]);
  });

  test("leaves out a kind the project hides, keeping its assets in the tree", () => {
    const catalog = new FakeTreeCatalog([MAP_RECORD, MODEL_RECORD], ["maps"]);
    const kindFilter = new ProjectKindFilter(new KindFilter(["voxelmodel"]));
    const { view } = treeView(catalog, { kindFilter });
    assert.deepEqual(kindFilters(view), ["", "voxelmap"]);
    assert.ok(view.model.has(assetNodeId(MODEL_RECORD.id)));

    kindFilter.replace(KindFilter.NONE);
    assert.deepEqual(kindFilters(view), ["", "voxelmap", "voxelmodel"]);
  });

  test("keeps offering a hidden kind while it is the active filter", () => {
    const catalog = new FakeTreeCatalog([MAP_RECORD, MODEL_RECORD], ["maps"]);
    const kindFilter = new ProjectKindFilter(KindFilter.NONE);
    const { view } = treeView(catalog, { kindFilter });

    view.filter("voxelmodel");
    kindFilter.replace(new KindFilter(["voxelmodel"]));
    assert.deepEqual(kindFilters(view), ["", "voxelmap", "voxelmodel"]);

    view.filter("");
    view.refresh();
    assert.deepEqual(kindFilters(view), ["", "voxelmap"]);
  });

  test("hides folders without the kind but keeps one created under it", async() => {
    const catalog = new FakeTreeCatalog([
      MAP_RECORD,
      {
        id: "tex-1",
        kind: "pixelart",
        path: "textures/stone.pixelart"
      }
    ], ["maps", "textures", "empty"]);
    const { view, created } = treeView(catalog);

    view.filter("voxelmap");
    view.refresh();
    assert.ok(view.model.has(folder("maps")));
    assert.equal(view.model.has(folder("textures")), false);
    assert.equal(view.model.has(folder("empty")), false);

    await view.createFolder(AssetPath.parse("maps"));
    catalog.change();
    view.refresh();
    assert.deepEqual(created, [folder("maps/New folder")]);
    assert.ok(view.model.has(folder("maps/New folder")));

    await view.rename(folder("maps/New folder"), "drafts");
    catalog.change();
    view.refresh();
    assert.ok(view.model.has(folder("maps/drafts")));

    view.filter("voxelmap");
    view.refresh();
    assert.equal(view.model.has(folder("maps/drafts")), false);

    view.filter("");
    view.refresh();
    assert.ok(view.model.has(folder("empty")));
    assert.ok(view.model.has(folder("maps/drafts")));
  });
});
