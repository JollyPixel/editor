// Import Node.js Dependencies
import {
  afterEach,
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type { AssetRecordData } from "@jolly-pixel/asset";
import type {
  ContextMenu,
  ContextMenuItem,
  Select
} from "@jolly-pixel/ui";

// Import Internal Dependencies
import type { LaunchNavigator } from "#src/launch/LaunchNavigator.ts";
import { EditorTargets } from "#src/session/EditorTargets.ts";
import { record } from "../helpers/rooms.ts";
import { createToolbarArchives } from "../helpers/session/archives.ts";
import {
  FakeNavigator,
  FakeSessionCatalog
} from "../helpers/session/catalog.ts";
import {
  mountToolbar as mount,
  pick,
  query
} from "../helpers/ui/toolbar.ts";

function voxelMaps(
  records: AssetRecordData[],
  navigator: LaunchNavigator = new FakeNavigator()
): EditorTargets {
  return new EditorTargets({
    catalog: new FakeSessionCatalog(records),
    accepts: "voxelmap",
    current: "forest",
    navigator
  });
}

function menuIds(
  menu: ContextMenu
): string[] {
  return menu.items.map((entry) => (entry === "separator" ? entry : entry.id));
}

function menuItem(
  menu: ContextMenu,
  id: string
): ContextMenuItem {
  const item = menu.items.find(
    (entry): entry is ContextMenuItem => entry !== "separator" && entry.id === id
  );
  assert.ok(item);

  return item;
}

describe("EditorToolbar assets", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  test("shows the Asset select for the only asset of its kind", async() => {
    const element = await mount(
      voxelMaps([record("forest", "voxelmap"), record("hero", "voxelmodel")]),
      null
    );
    const assets = query<Select<string>>(element, ".asset jolly-select")!;

    assert.ok(!element.hasAttribute("empty"));
    assert.deepEqual(
      assets.options.map((option) => option.value),
      ["forest"]
    );
  });

  test("lists assets by path without extension and opens the picked one", async() => {
    const navigator = new FakeNavigator();
    const cave = {
      ...record("cave", "voxelmap"),
      path: "maps/cave.voxelmap.json"
    };
    const element = await mount(
      voxelMaps([record("forest", "voxelmap"), cave], navigator),
      null
    );
    const assets = query<Select<string>>(element, ".asset jolly-select")!;

    pick(assets, "cave");

    assert.ok(!element.hasAttribute("empty"));
    assert.deepEqual(
      assets.options.map((option) => option.label),
      ["forest", "maps/cave"]
    );
    assert.deepEqual(navigator.navigations, [
      {
        target: "cave",
        tag: null
      }
    ]);
  });

  test("the asset menu offers the archive actions the session allows and runs the picked one", async() => {
    const archives = createToolbarArchives({
      canImport: true,
      canReset: true
    });
    const element = await mount(
      voxelMaps([record("forest", "voxelmap"), record("cave", "voxelmap")]),
      null,
      { archives }
    );
    const menu = query<ContextMenu>(element, "#asset-menu")!;

    query(element, "#asset-actions")!.click();
    menu.dispatchEvent(new CustomEvent("jolly-context-action", {
      detail: { id: "export" }
    }));
    await element.updateComplete;

    assert.deepEqual(menuIds(menu), [
      "rename",
      "export",
      "import",
      "separator",
      "delete",
      "reset"
    ]);
    assert.ok(!menuItem(menu, "delete").disabled);
    assert.deepEqual(archives.calls, ["download"]);
  });

  test("the asset menu hides what the session refuses and never deletes the last asset", async() => {
    const element = await mount(
      voxelMaps([record("forest", "voxelmap")]),
      null,
      { archives: createToolbarArchives({ canImport: false }) }
    );
    const menu = query<ContextMenu>(element, "#asset-menu")!;

    query(element, "#asset-actions")!.click();
    menu.dispatchEvent(new CustomEvent("jolly-context-action", {
      detail: { id: "delete" }
    }));
    await element.updateComplete;

    assert.deepEqual(menuIds(menu), ["rename", "export", "separator", "delete"]);
    assert.equal(menuItem(menu, "delete").disabled, true);
    assert.equal(query(element, ".error"), null);
  });

  test("the asset menu exports a dependency picked in its submenu", async() => {
    const archives = createToolbarArchives({
      canImport: false,
      dependencies: [
        {
          ...record("stone", "blockset"),
          path: "blocksets/stone.blockset.json"
        }
      ]
    });
    const element = await mount(
      voxelMaps([record("forest", "voxelmap")]),
      null,
      { archives }
    );
    const menu = query<ContextMenu>(element, "#asset-menu")!;

    query(element, "#asset-actions")!.click();
    menu.dispatchEvent(new CustomEvent("jolly-context-action", {
      detail: { id: "dependency:stone" }
    }));
    await element.updateComplete;

    assert.deepEqual(
      menuItem(menu, "dependencies").items?.map(
        (entry) => (entry === "separator" ? entry : entry.label)
      ),
      ["blocksets/stone"]
    );
    assert.deepEqual(archives.calls, ["download stone"]);
  });
});
