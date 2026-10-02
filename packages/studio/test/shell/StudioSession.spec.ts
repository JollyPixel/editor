// Import Node.js Dependencies
import {
  afterEach,
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { SHELL_MESSAGE_TYPE } from "@jolly-pixel/editor.host";
import { MemoryStorageAdapter } from "@jolly-pixel/ui";

// Import Internal Dependencies
import { HOME_TAB_ID } from "../../src/tabs/EditorTabs.ts";
import {
  CAVE_RECORD,
  disposeSession,
  FakeCatalog,
  frameTargets,
  MAP_RECORD,
  MODEL_RECORD,
  session,
  TEXTURE_RECORD
} from "../helpers/studioSession.ts";

function postFromFrame(
  data: unknown
): void {
  window.dispatchEvent(new MessageEvent("message", {
    source: document.querySelector("iframe")?.contentWindow ?? null,
    data
  }));
}

afterEach(disposeSession);

describe("StudioSession", () => {
  test("opens an asset in its editor, labelled without its extension", async() => {
    const studio = session(new FakeCatalog([MAP_RECORD]));

    assert.equal(await studio.openAsset("map-1"), true);

    assert.deepEqual(studio.tabs.ids(), ["map-1"]);
    const [tab] = studio.tabs.list();
    assert.equal(tab.label, "overworld");
    assert.equal(tab.tooltip, "maps/overworld.voxelmap.json");
    const frame = document.querySelector("iframe");
    assert.equal(frame?.title, "overworld");
    assert.ok(frame?.src.endsWith("/editors/voxel-map/?target=map-1"));
  });

  test("does not open an unknown asset or a kind without editor", async() => {
    const studio = session(new FakeCatalog([TEXTURE_RECORD]));

    assert.equal(await studio.openAsset("missing"), false);
    assert.equal(await studio.openAsset("texture-1"), false);
    assert.deepEqual(studio.tabs.ids(), []);
  });

  test("follows catalog renames and deletions", async() => {
    const catalog = new FakeCatalog([MAP_RECORD]);
    const studio = session(catalog);
    await studio.openAsset("map-1");

    catalog.records.set("map-1", {
      ...MAP_RECORD,
      source: "maps/cave.voxelmap.json"
    });
    catalog.change();
    assert.equal(document.querySelector("iframe")?.title, "cave");
    assert.equal(studio.tabs.list()[0].tooltip, "maps/cave.voxelmap.json");

    catalog.records.delete("map-1");
    catalog.change();
    assert.deepEqual(studio.tabs.ids(), []);
  });

  test("reports tab changes, catalog renames included", async() => {
    const catalog = new FakeCatalog([MAP_RECORD]);
    const labels: string[][] = [];
    const studio = session(
      catalog,
      new MemoryStorageAdapter(),
      undefined,
      {
        onTabsChange: () => labels.push(
          studio.tabs.list().map((tab) => tab.label)
        )
      }
    );
    await studio.openAsset("map-1");

    catalog.records.set("map-1", {
      ...MAP_RECORD,
      source: "maps/cave.voxelmap.json"
    });
    catalog.change();

    assert.deepEqual(labels, [
      ["overworld"],
      ["cave"]
    ]);
  });

  test("opens the target of an editor's open-asset command", async() => {
    const studio = session(new FakeCatalog([MAP_RECORD]));
    await studio.openAsset("map-1");
    studio.tabs.focus(HOME_TAB_ID);

    postFromFrame({
      type: SHELL_MESSAGE_TYPE,
      command: "open-asset",
      target: "map-1"
    });
    await Promise.resolve();

    assert.equal(studio.tabs.active, "map-1");
  });

  test("reloads the tabs of a rebuilt editor only", async() => {
    const studio = session(new FakeCatalog([MAP_RECORD, CAVE_RECORD, MODEL_RECORD]));
    await studio.openAsset("map-1");
    await studio.openAsset("map-2");
    await studio.openAsset("model-1");
    const model = document.querySelector("iframe[src*='model-1']");

    studio.reloadEditor("voxel-map");

    assert.deepEqual(frameTargets(), ["model-1"]);
    assert.equal(document.querySelector("iframe[src*='model-1']"), model);
  });

  test("toggles the console on an editor's toggle-console command", async() => {
    let toggles = 0;
    const studio = session(
      new FakeCatalog([MAP_RECORD]),
      new MemoryStorageAdapter(),
      undefined,
      {
        onToggleConsole: () => {
          toggles++;
        }
      }
    );
    await studio.openAsset("map-1");

    postFromFrame({
      type: SHELL_MESSAGE_TYPE,
      command: "toggle-console"
    });

    assert.equal(toggles, 1);
    assert.equal(studio.tabs.active, "map-1");
  });

  test("dispose stops following the catalog", () => {
    const catalog = new FakeCatalog([MAP_RECORD]);
    const studio = session(catalog);

    studio.dispose();

    assert.equal(catalog.listening, 0);
  });
});
