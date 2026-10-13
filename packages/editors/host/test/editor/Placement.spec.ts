// Import Node.js Dependencies
import {
  afterEach,
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { AssetId } from "@jolly-pixel/asset";

// Import Internal Dependencies
import { Placement } from "#src/editor/Placement.ts";
import { EditorLaunch } from "#src/launch/EditorLaunch.ts";
import {
  SHELL_MESSAGE_TYPE,
  ShellChannel,
  isShellCommand
} from "#src/launch/ShellChannel.ts";
import { PageState } from "#src/state/PageState.ts";
import type { SessionWorkspace } from "#src/workspace/SessionWorkspace.ts";
import { fakeDocumentKind, record } from "../helpers/rooms.ts";
import {
  FakeNavigator,
  FakeSessionCatalog
} from "../helpers/session/catalog.ts";
import { fakeConnection } from "../helpers/session/connection.ts";
import { resetStandalonePage } from "../helpers/standalone.ts";

// CONSTANTS
const kShell = new ShellChannel({
  port: { postMessage: () => undefined },
  origin: "http://studio.test"
});
const kWorkspace: SessionWorkspace = {
  persistent: true,
  reset: () => Promise.resolve()
};

function toolbar(
  launch: EditorLaunch,
  workspace: SessionWorkspace | null = null
) {
  return new Placement(launch).toolbar(launch, {
    catalog: new FakeSessionCatalog(),
    workspace,
    assets: { unsaved: false },
    target: { record: record("map", "voxelmap") }
  }, new FakeNavigator());
}

function unload(): boolean {
  const event = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(event);

  return event.defaultPrevented;
}

describe("Placement toolbar", () => {
  test("a standalone page switches between targets of its kind and views the launch tag", () => {
    const { targets, tags } = toolbar(
      new EditorLaunch(new AssetId("map")).viewing("v1")
    );

    assert.equal(targets?.accepts, "voxelmap");
    assert.equal(targets?.current, "map");
    assert.equal(tags?.assetId, "map");
    assert.equal(tags?.viewing, "v1");
  });

  for (const { title, launch, workspace, hasTargets, hasTags } of [
    {
      title: "a shell picks the target itself but offers tags",
      launch: new EditorLaunch(new AssetId("map"), kShell),
      workspace: null,
      hasTargets: false,
      hasTags: true
    },
    {
      title: "a share link offers neither",
      launch: new EditorLaunch(new AssetId("map"), null, "token"),
      workspace: null,
      hasTargets: false,
      hasTags: false
    },
    {
      title: "an offline workspace offers targets but no tags",
      launch: new EditorLaunch(new AssetId("map")),
      workspace: kWorkspace,
      hasTargets: true,
      hasTags: false
    }
  ]) {
    test(title, () => {
      const { targets, tags } = toolbar(launch, workspace);

      assert.equal(targets !== null, hasTargets);
      assert.equal(tags !== null, hasTags);
    });
  }
});

describe("Placement unsaved guard", () => {
  test("reports the unsaved state of the leased documents to the shell", async() => {
    const posted: unknown[] = [];
    const shell = new ShellChannel({
      port: { postMessage: (message) => posted.push(message) },
      origin: "http://studio.test"
    });
    const { connection } = await fakeConnection();
    const leaving = new AbortController();
    new Placement(new EditorLaunch(new AssetId("map"), shell))
      .guardUnsaved(connection.assets, leaving.signal);
    const map = connection.assets.open(fakeDocumentKind("voxelmap"), "map");

    map.document.changes.edit();
    map.document.changes.edit();
    map.document.changes.acknowledge();
    map.document.changes.edit();
    leaving.abort();
    map.document.changes.acknowledge();
    connection.dispose();

    assert.deepEqual(
      posted.filter((message) => isShellCommand(message)),
      [true, false, true].map((unsaved) => {
        return {
          type: SHELL_MESSAGE_TYPE,
          command: "unsaved",
          unsaved
        };
      })
    );
  });

  test("asks before unloading while unsaved when no shell framed the page", async() => {
    const { connection } = await fakeConnection();
    const leaving = new AbortController();
    new Placement(new EditorLaunch(new AssetId("map")))
      .guardUnsaved(connection.assets, leaving.signal);
    const map = connection.assets.open(fakeDocumentKind("voxelmap"), "map");

    assert.equal(unload(), false);
    map.document.changes.edit();
    assert.equal(unload(), true);
    map.document.changes.acknowledge();
    assert.equal(unload(), false);

    map.document.changes.edit();
    leaving.abort();
    assert.equal(unload(), false);
    connection.dispose();
  });
});

describe("Placement state report", () => {
  afterEach(resetStandalonePage);

  test("reports the current editor state then every change to the shell until left", () => {
    const posted: unknown[] = [];
    const shell = new ShellChannel({
      port: { postMessage: (message) => posted.push(message) },
      origin: "http://studio.test"
    });
    const page = new PageState();
    const leaving = new AbortController();
    page.show("booting");

    new Placement(new EditorLaunch(new AssetId("map"), shell))
      .reportState(page, leaving.signal);
    page.show("ready");
    page.show("switching");
    page.show("failed");
    leaving.abort();
    page.show("ready");

    assert.deepEqual(
      posted.filter((message) => isShellCommand(message)),
      (["booting", "ready", "switching", "failed"] as const).map((state) => {
        return {
          type: SHELL_MESSAGE_TYPE,
          command: "editor-state",
          state
        };
      })
    );
  });
});
