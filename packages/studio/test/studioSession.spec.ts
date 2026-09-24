// Import Node.js Dependencies
import {
  afterEach,
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type { AssetRecordData } from "@jolly-pixel/asset";
import { SHELL_MESSAGE_TYPE } from "@jolly-pixel/editor.host";

// Import Internal Dependencies
import { EditorRegistry } from "../src/editors/EditorRegistry.ts";
import "../src/icons.ts";
import {
  StudioSession,
  type StudioCatalog
} from "../src/shell/StudioSession.ts";
import { HOME_TAB_ID } from "../src/tabs/EditorTabs.ts";

// CONSTANTS
const kMap: AssetRecordData = {
  id: "map-1",
  kind: "voxelmap",
  source: "maps/overworld.voxelmap.json"
};
const kTexture: AssetRecordData = {
  id: "texture-1",
  kind: "texture",
  source: "textures/block.png"
};

class FakeCatalog implements StudioCatalog {
  records = new Map<string, AssetRecordData>();
  #listeners = new Set<() => void>();

  constructor(
    records: Iterable<AssetRecordData>
  ) {
    for (const record of records) {
      this.records.set(record.id, record);
    }
  }

  get listening(): number {
    return this.#listeners.size;
  }

  record(
    assetId: string
  ): AssetRecordData | undefined {
    return this.records.get(assetId);
  }

  on(
    _event: "change",
    listener: () => void
  ): void {
    this.#listeners.add(listener);
  }

  off(
    _event: "change",
    listener: () => void
  ): void {
    this.#listeners.delete(listener);
  }

  change(): void {
    for (const listener of this.#listeners) {
      listener();
    }
  }
}

let current: StudioSession | undefined;

function session(
  catalog: FakeCatalog
): StudioSession {
  const strip = Object.assign(document.createElement("jolly-tabs"), {
    value: ""
  });
  const frames = document.createElement("div");
  const home = document.createElement("section");
  document.body.append(strip, frames, home);
  current = new StudioSession({
    catalog,
    editors: new EditorRegistry().registerEditor({
      name: "voxel-map",
      kinds: ["voxelmap"]
    }),
    tabs: {
      strip,
      frames,
      home,
      launchOrigin: "http://localhost"
    }
  });

  return current;
}

afterEach(() => {
  current?.dispose();
  current = undefined;
  document.body.replaceChildren();
});

describe("StudioSession", () => {
  test("opens an asset in its editor, labelled by its file name", async() => {
    const studio = session(new FakeCatalog([kMap]));

    assert.equal(await studio.openAsset("map-1"), true);

    assert.deepEqual(studio.tabs.ids(), ["map-1"]);
    const frame = document.querySelector("iframe");
    assert.equal(frame?.title, "overworld.voxelmap.json");
    assert.ok(frame?.src.endsWith("/editors/voxel-map/?target=map-1"));
  });

  test("does not open an unknown asset or a kind without editor", async() => {
    const studio = session(new FakeCatalog([kTexture]));

    assert.equal(await studio.openAsset("missing"), false);
    assert.equal(await studio.openAsset("texture-1"), false);
    assert.deepEqual(studio.tabs.ids(), []);
  });

  test("follows catalog renames and deletions", async() => {
    const catalog = new FakeCatalog([kMap]);
    const studio = session(catalog);
    await studio.openAsset("map-1");

    catalog.records.set("map-1", {
      ...kMap,
      source: "maps/cave.voxelmap.json"
    });
    catalog.change();
    assert.equal(document.querySelector("iframe")?.title, "cave.voxelmap.json");

    catalog.records.delete("map-1");
    catalog.change();
    assert.deepEqual(studio.tabs.ids(), []);
  });

  test("opens the target of an editor's open-asset command", async() => {
    const studio = session(new FakeCatalog([kMap]));
    await studio.openAsset("map-1");
    studio.tabs.focus(HOME_TAB_ID);

    window.dispatchEvent(new MessageEvent("message", {
      source: document.querySelector("iframe")?.contentWindow ?? null,
      data: {
        type: SHELL_MESSAGE_TYPE,
        command: "open-asset",
        target: "map-1"
      }
    }));
    await Promise.resolve();

    assert.equal(studio.tabs.active, "map-1");
  });

  test("dispose stops following the catalog", () => {
    const catalog = new FakeCatalog([kMap]);
    const studio = session(catalog);

    studio.dispose();
    current = undefined;

    assert.equal(catalog.listening, 0);
  });
});
