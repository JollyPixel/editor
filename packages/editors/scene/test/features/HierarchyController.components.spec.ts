// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { AssetType } from "@jolly-pixel/asset";
import type { JollyReparentDetail } from "@jolly-pixel/ui";

// Import Internal Dependencies
import { HierarchyRows } from "../../src/features/hierarchy/HierarchyRows.ts";
import {
  createHierarchy,
  itemIds,
  selectRows
} from "../helpers/hierarchy/hierarchyController.ts";
import { ANCHORED_COMPONENTS } from "../helpers/probeComponents.ts";
import { createSceneComponents } from "../helpers/sceneComponents.ts";

// CONSTANTS
const kSpawn = { component: "map", key: "object:spawn" };
const kPoint = { x: 0, y: 0 };

describe("HierarchyController components", () => {
  const kMapRow = HierarchyRows.componentRowId("map");

  test("focuses a component row with its owner as the actor selection, and reveals it", () => {
    const { mapId, selection, hierarchy } = createHierarchy();
    assert.strictEqual(hierarchy.expanded.length, 0);

    selectRows(hierarchy, [kMapRow]);

    assert.deepEqual(
      [selection.ids, selection.focused],
      [[mapId], { ownerId: mapId, componentId: "map" }]
    );
    assert.deepEqual(hierarchy.selected, [kMapRow]);
    assert.ok(hierarchy.expanded.includes(mapId));

    selectRows(hierarchy, [kMapRow, mapId]);

    assert.deepEqual([selection.ids, selection.focused], [[mapId], null]);
  });

  test("focuses the clicked component of a range that spans several components", () => {
    const { document, mapId, selection, hierarchy } = createHierarchy();
    document.addComponent(mapId, { id: "camera", type: "Camera" });
    document.addComponent(mapId, { id: "light", type: "Light" });
    selectRows(hierarchy, [kMapRow]);

    const lightRow = HierarchyRows.componentRowId("light");
    selectRows(hierarchy, [kMapRow, HierarchyRows.componentRowId("camera"), lightRow], lightRow);

    assert.strictEqual(selection.focused?.componentId, "light");
  });

  test("removes a component from its row menu and adds one from the actor row menu", async() => {
    const { document, mapId, selection, hierarchy } = createHierarchy();

    const componentMenu = hierarchy.openMenu(kMapRow);
    assert.deepEqual(itemIds(componentMenu.items), ["duplicate", "-", "delete"]);
    assert.strictEqual(selection.focused?.componentId, "map");
    await componentMenu.run("delete", kPoint);
    assert.deepEqual(document.tree.actor(mapId)!.components, []);

    await hierarchy.openMenu(mapId).run("add-component:Camera", kPoint);

    const [camera] = document.tree.actor(mapId)!.components;
    assert.strictEqual(camera.type, "Camera");
    assert.strictEqual(selection.focused?.componentId, camera.id);
  });

  test("reorders a component dropped beside a sibling", () => {
    const { document, mapId, hierarchy } = createHierarchy();
    document.addComponent(mapId, { id: "camera", type: "Camera" });

    hierarchy.handleReparent(new CustomEvent<JollyReparentDetail>("jolly-reparent", {
      detail: { movedIds: [HierarchyRows.componentRowId("camera")], targetId: kMapRow, where: "above" }
    }));

    assert.deepEqual(document.tree.actor(mapId)!.components.map(({ id }) => id), ["camera", "map"]);
  });

  test("expands every branch and collapses them all back from the tree menu", async() => {
    const { mapId, document, hierarchy } = createHierarchy();
    document.addActor({ name: "Coin", parentId: mapId, anchor: kSpawn });
    await hierarchy.treeMenu().run("collapse-all", kPoint);
    assert.strictEqual(hierarchy.expanded.length, 0);

    await hierarchy.treeMenu().run("expand-all", kPoint);
    assert.deepEqual(
      new Set(hierarchy.expanded),
      new Set([mapId, kMapRow, HierarchyRows.anchorRowId({ ownerId: mapId, anchor: kSpawn })])
    );

    await hierarchy.treeMenu().run("collapse-all", kPoint);
    assert.strictEqual(hierarchy.expanded.length, 0);
  });

  test("renames a component row when the catalog renames its asset", () => {
    const [name, { components: [anchored] }] = ANCHORED_COMPONENTS;
    const { mapId, hierarchy, renameAsset } = createHierarchy(
      () => undefined,
      createSceneComponents([name, {
        components: [{
          ...anchored,
          definition: {
            ...anchored.definition,
            assets: { map: new AssetType<unknown>("voxelmap") }
          }
        }]
      }])
    );
    function detail(): string | undefined {
      return hierarchy.nodes
        .find(({ id }) => id === mapId)
        ?.children?.find(({ id }) => id === kMapRow)
        ?.detail;
    }
    assert.strictEqual(detail(), "Overworld");

    renameAsset("Dungeon");

    assert.strictEqual(detail(), "Dungeon");
  });
});
