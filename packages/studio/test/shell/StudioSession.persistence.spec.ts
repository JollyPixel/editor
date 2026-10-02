// Import Node.js Dependencies
import {
  afterEach,
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { MemoryStorageAdapter } from "@jolly-pixel/ui";

// Import Internal Dependencies
import { TABS_STORAGE_KEY } from "../../src/shell/StudioSession.ts";
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

afterEach(disposeSession);

describe("StudioSession tab persistence", () => {
  test("restores the saved tabs in order and loads only the active one", async() => {
    const catalog = new FakeCatalog([MAP_RECORD, CAVE_RECORD, MODEL_RECORD]);
    const storage = new MemoryStorageAdapter();
    const first = session(catalog, storage);
    await first.openAsset("map-1");
    await first.openAsset("model-1");
    await first.openAsset("map-2");
    first.tabs.move("map-2", 1);
    first.tabs.focus("model-1");
    disposeSession();

    const second = session(catalog, storage);
    await second.restoreTabs();

    assert.deepEqual(second.tabs.ids(), ["map-2", "map-1", "model-1"]);
    assert.equal(second.tabs.active, "model-1");
    assert.deepEqual(frameTargets(), ["model-1"]);
  });

  test("restores up to the cap, skipping assets it cannot open", async() => {
    const storage = new MemoryStorageAdapter();
    storage.set(TABS_STORAGE_KEY, JSON.stringify({
      ids: ["missing", "texture-1", "map-1", "model-1", "map-2"],
      active: "missing"
    }));
    const studio = session(
      new FakeCatalog([MAP_RECORD, CAVE_RECORD, MODEL_RECORD, TEXTURE_RECORD]),
      storage,
      2
    );

    await studio.restoreTabs();

    assert.deepEqual(studio.tabs.ids(), ["map-1", "model-1"]);
    assert.equal(studio.tabs.active, HOME_TAB_ID);
    assert.deepEqual(frameTargets(), []);
    assert.deepEqual(JSON.parse(storage.get(TABS_STORAGE_KEY) ?? ""), {
      ids: ["map-1", "model-1"],
      active: HOME_TAB_ID
    });
  });

  test("restores nothing from an unreadable save", async() => {
    const storage = new MemoryStorageAdapter();
    storage.set(TABS_STORAGE_KEY, "{\"ids\":[1]");
    const studio = session(new FakeCatalog([MAP_RECORD]), storage);

    await studio.restoreTabs();

    assert.deepEqual(studio.tabs.ids(), []);
    assert.equal(studio.tabs.active, HOME_TAB_ID);
  });

  test("forgets a tab whose asset is deleted", async() => {
    const catalog = new FakeCatalog([MAP_RECORD, MODEL_RECORD]);
    const storage = new MemoryStorageAdapter();
    const studio = session(catalog, storage);
    await studio.openAsset("map-1");
    await studio.openAsset("model-1");

    catalog.records.delete("map-1");
    catalog.change();

    assert.deepEqual(JSON.parse(storage.get(TABS_STORAGE_KEY) ?? ""), {
      ids: ["model-1"],
      active: "model-1"
    });
  });
});
