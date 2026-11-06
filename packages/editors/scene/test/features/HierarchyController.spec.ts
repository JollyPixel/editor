// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type { AssetReferenceData } from "@jolly-pixel/asset";
import type {
  ContextMenuEntry,
  JollyToggleExpandDetail
} from "@jolly-pixel/ui";

// Import Internal Dependencies
import { HierarchyRows } from "../../src/features/hierarchy/HierarchyRows.ts";
import {
  createHierarchy,
  itemIds,
  MAP_ASSET
} from "../helpers/hierarchy/hierarchyController.ts";
import { createSceneComponents } from "../helpers/sceneComponents.ts";

// CONSTANTS
const kSpawn = { component: "map", key: "object:spawn" };
const kPoint = { x: 0, y: 0 };

function showItem(
  items: readonly ContextMenuEntry[]
) {
  return items.find((item) => item !== "separator" && item.id === "show-in-asset");
}

describe("HierarchyController anchors", () => {
  test("shows an anchor in the asset that publishes it, at the anchor's key", async() => {
    const opened: Array<[AssetReferenceData, string | undefined]> = [];
    const { mapId, hierarchy } = createHierarchy(
      (reference, reveal) => opened.push([reference, reveal])
    );

    const menu = hierarchy.openMenu(HierarchyRows.anchorRowId({ ownerId: mapId, anchor: kSpawn }));
    const show = showItem(menu.items);
    assert.ok(show !== undefined && show !== "separator");
    assert.strictEqual(show.label, "Show in Overworld");
    assert.notStrictEqual(show.disabled, true);

    await menu.run("show-in-asset", kPoint);

    assert.deepEqual(opened, [[MAP_ASSET, "object:spawn"]]);
  });

  test("disables showing a lost anchor, and offers nothing without a shell or an anchor asset", () => {
    const gone = { component: "map", key: "object:gone" };
    const withShell = createHierarchy();
    withShell.document.addActor({ name: "Coin", parentId: withShell.mapId, anchor: gone });
    const withoutShell = createHierarchy(null);
    const withoutAnchorAsset = createHierarchy(
      () => undefined,
      createSceneComponents()
    );

    const missing = showItem(withShell.hierarchy.openMenu(
      HierarchyRows.anchorRowId({ ownerId: withShell.mapId, anchor: gone })
    ).items);
    assert.ok(missing !== undefined && missing !== "separator");
    assert.strictEqual(missing.disabled, true);

    for (const { hierarchy, mapId } of [withoutShell, withoutAnchorAsset]) {
      assert.strictEqual(showItem(hierarchy.openMenu(
        HierarchyRows.anchorRowId({ ownerId: mapId, anchor: kSpawn })
      ).items), undefined);
    }
  });

  test("expands the owner of a picked anchor and reveals its row", () => {
    const { mapId, anchorPicks, hierarchy, revealed } = createHierarchy();
    hierarchy.handleToggleExpand(new CustomEvent<JollyToggleExpandDetail>(
      "jolly-toggle-expand",
      { detail: { id: mapId, expanded: false } }
    ));
    assert.ok(!hierarchy.expanded.includes(mapId));

    anchorPicks.emit("pick", { ownerId: mapId, anchor: kSpawn });

    assert.ok(hierarchy.expanded.includes(mapId));
    assert.deepEqual(revealed, [HierarchyRows.anchorRowId({ ownerId: mapId, anchor: kSpawn })]);
  });
});

describe("HierarchyController add menus", () => {
  test("offers only actors away from an actor row, and components only on one", async() => {
    const { document, mapId, hierarchy } = createHierarchy();
    const anchorRow = HierarchyRows.anchorRowId({ ownerId: mapId, anchor: kSpawn });

    for (const menu of [hierarchy.addMenu(), hierarchy.openMenu(null), hierarchy.openMenu(anchorRow)]) {
      assert.deepEqual(itemIds(menu.items).slice(0, 2), ["add-actor", "add-instance"]);
    }
    assert.deepEqual(
      itemIds(hierarchy.openMenu(mapId).items).slice(0, 2),
      ["group:add-child", "group:add-component"]
    );

    await hierarchy.openMenu(mapId).run("add-actor", kPoint);

    const [child] = [...document.tree.actors()].filter(({ parentId }) => parentId === mapId);
    assert.deepEqual([child.name, child.components], ["Actor", []]);
  });
});
