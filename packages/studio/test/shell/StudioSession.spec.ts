// Import Node.js Dependencies
import {
  afterEach,
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  READY_MESSAGE_TYPE,
  revealMessage,
  SESSION_RENEWED_MESSAGE_TYPE,
  SHELL_MESSAGE_TYPE
} from "@jolly-pixel/editor.host";
import { Preferences } from "@jolly-pixel/editor.host/preferences";
import { MemoryStorageAdapter } from "@jolly-pixel/ui";

// Import Internal Dependencies
import { HOME_TAB_ID } from "../../src/tabs/EditorTabs.ts";
import {
  frame,
  FRAME_ORIGIN,
  recordPosts
} from "../helpers/editorFrames.ts";
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

function unload(): boolean {
  const event = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(event);

  return event.defaultPrevented;
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
      path: "maps/cave.voxelmap.json"
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
      path: "maps/cave.voxelmap.json"
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

  test("hands the reveal of an open-asset command to the opened editor once it launches", async() => {
    const studio = session(new FakeCatalog([MAP_RECORD]));
    await studio.openAsset("map-1");
    const posted = recordPosts(frame());

    postFromFrame({
      type: SHELL_MESSAGE_TYPE,
      command: "open-asset",
      target: "map-1",
      reveal: "object:spawn"
    });
    await Promise.resolve();
    postFromFrame({ type: READY_MESSAGE_TYPE });

    assert.deepEqual(posted[1]?.[0], revealMessage("object:spawn"));
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
        console: {
          toggle: () => {
            toggles++;
          }
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

  test("renews the session on an editor's session-refused command, then tells the frames", async() => {
    let renewals = 0;
    const renewed = new Set<() => void>();
    const studio = session(
      new FakeCatalog([MAP_RECORD]),
      new MemoryStorageAdapter(),
      undefined,
      {
        user: {
          identity: null,
          preferences: new Preferences(),
          renewal: {
            async renew() {
              renewals++;
              for (const listener of renewed) {
                listener();
              }
            },
            onRenewed(listener) {
              renewed.add(listener);

              return () => renewed.delete(listener);
            }
          }
        }
      }
    );
    await studio.openAsset("map-1");
    const posted = recordPosts(frame());

    postFromFrame({
      type: SHELL_MESSAGE_TYPE,
      command: "session-refused"
    });

    assert.equal(renewals, 1);
    assert.deepEqual(posted, [
      [{ type: SESSION_RENEWED_MESSAGE_TYPE }, FRAME_ORIGIN]
    ]);
  });

  test("marks the tab of an editor's unsaved command and asks before unloading until it closes", async() => {
    const studio = session(new FakeCatalog([MAP_RECORD]));
    await studio.openAsset("map-1");
    const item = [...document.querySelectorAll("jolly-tab")].find(
      (tab) => tab.value === "map-1"
    );
    postFromFrame({
      type: SHELL_MESSAGE_TYPE,
      command: "unsaved",
      unsaved: true
    });
    assert.equal(item?.modified, true);
    assert.equal(unload(), true);

    postFromFrame({
      type: SHELL_MESSAGE_TYPE,
      command: "unsaved",
      unsaved: false
    });
    assert.equal(item?.modified, false);
    assert.equal(unload(), false);

    postFromFrame({
      type: SHELL_MESSAGE_TYPE,
      command: "unsaved",
      unsaved: true
    });
    studio.tabs.close("map-1");
    assert.equal(unload(), false);
  });

  test("follows the editor state a frame reports on its tab", async() => {
    const studio = session(new FakeCatalog([MAP_RECORD]));
    await studio.openAsset("map-1");
    const item = [...document.querySelectorAll("jolly-tab")].find(
      (tab) => tab.value === "map-1"
    );
    const statuses = (["ready", "switching", "failed"] as const).map((state) => {
      postFromFrame({
        type: SHELL_MESSAGE_TYPE,
        command: "editor-state",
        state
      });

      return item?.status;
    });

    assert.deepEqual(statuses, ["idle", "busy", "failed"]);
  });

  test("dispose stops following the catalog", () => {
    const catalog = new FakeCatalog([MAP_RECORD]);
    const studio = session(catalog);

    studio.dispose();

    assert.equal(catalog.listening, 0);
  });
});
