// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { assetNodeId } from "../../../src/catalog/AssetTreeModel.ts";
import type {
  AssetTreeView,
  KindFilterSource
} from "../../../src/shell/assets/AssetTreeView.ts";
import { KIND_FILTER_CHANGE } from "../../../src/project/StudioProjectSettings.ts";
import { KindFilter } from "../../../shared/KindFilter.ts";
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
});
