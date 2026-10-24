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
import {
  Placement,
  type PlacedSession
} from "#src/boot/Placement.ts";
import { readDebugLogger } from "#src/debug/readDebugLogger.ts";
import { EditorLaunch } from "#src/launch/EditorLaunch.ts";
import {
  SHELL_MESSAGE_TYPE,
  ShellChannel,
  isShellCommand
} from "#src/shell/ShellChannel.ts";
import { PageState } from "#src/boot/PageState.ts";
import type { OfflineMode } from "#src/connection/OfflineMode.ts";
import { LAST_OPENED_STORAGE_PREFIX } from "#src/launch/sources/LastOpenedLaunchSource.ts";
import { fakeDocumentKind, record } from "../helpers/rooms.ts";
import { createToolbarArchives } from "../helpers/session/archives.ts";
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
const kOffline: OfflineMode = {
  persistent: true,
  reset: () => Promise.resolve()
};

const kReleases: Array<() => void> = [];

function place(
  launch: EditorLaunch,
  page = new PageState()
): Placement {
  const placement = new Placement(launch, {
    page,
    logger: readDebugLogger()
  });
  kReleases.push(() => placement.dispose());

  return placement;
}

function leaveAll(): void {
  for (const release of kReleases.splice(0).reverse()) {
    release();
  }
  resetStandalonePage();
}

function placedSession(
  offline: OfflineMode | null = null
): PlacedSession {
  return {
    catalog: new FakeSessionCatalog(),
    offline,
    assets: { unsaved: false },
    connectionStatus: null,
    target: { record: record("map", "voxelmap") }
  };
}

function toolbar(
  launch: EditorLaunch,
  offline: OfflineMode | null = null
) {
  return place(launch).context({
    launch,
    session: placedSession(offline),
    navigator: new FakeNavigator(),
    own: (release) => kReleases.push(release)
  }, createToolbarArchives()).toolbar;
}

function unload(): boolean {
  const event = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(event);

  return event.defaultPrevented;
}

describe("Placement toolbar", () => {
  afterEach(leaveAll);

  test("a standalone page switches between targets of its kind and views the launch tag", () => {
    const { targets, tags } = toolbar(
      new EditorLaunch(new AssetId("map")).viewing("v1")
    );

    assert.equal(targets?.accepts, "voxelmap");
    assert.equal(targets?.current, "map");
    assert.equal(tags?.assetId, "map");
    assert.equal(tags?.viewing, "v1");
  });

  for (const { title, launch, offline, hasTargets, hasTags } of [
    {
      title: "a shell picks the target itself but offers tags",
      launch: new EditorLaunch(new AssetId("map"), kShell),
      offline: null,
      hasTargets: false,
      hasTags: true
    },
    {
      title: "a share link offers neither",
      launch: new EditorLaunch(new AssetId("map"), null, "token"),
      offline: null,
      hasTargets: false,
      hasTags: false
    },
    {
      title: "offline mode offers targets but no tags",
      launch: new EditorLaunch(new AssetId("map")),
      offline: kOffline,
      hasTargets: true,
      hasTags: false
    }
  ]) {
    test(title, () => {
      const { targets, tags } = toolbar(launch, offline);

      assert.equal(targets !== null, hasTargets);
      assert.equal(tags !== null, hasTags);
    });
  }
});

describe("Placement unsaved guard", () => {
  afterEach(leaveAll);

  test("reports the unsaved state of the leased documents to the shell", async() => {
    const posted: unknown[] = [];
    const shell = new ShellChannel({
      port: { postMessage: (message) => posted.push(message) },
      origin: "http://studio.test"
    });
    const { connection } = await fakeConnection();
    const placement = place(new EditorLaunch(new AssetId("map"), shell));
    placement.guardUnsaved(connection.assets);
    const map = connection.assets.open(fakeDocumentKind("voxelmap"), "map");

    map.document.changes.edit();
    map.document.changes.edit();
    map.document.changes.acknowledge();
    map.document.changes.edit();
    placement.dispose();
    map.document.changes.acknowledge();
    connection.dispose();

    assert.deepEqual(
      posted.filter((message) => isShellCommand(message) &&
        message.command === "unsaved"),
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
    const placement = place(new EditorLaunch(new AssetId("map")));
    placement.guardUnsaved(connection.assets);
    const map = connection.assets.open(fakeDocumentKind("voxelmap"), "map");

    assert.equal(unload(), false);
    map.document.changes.edit();
    assert.equal(unload(), true);
    map.document.changes.acknowledge();
    assert.equal(unload(), false);

    map.document.changes.edit();
    placement.dispose();
    assert.equal(unload(), false);
    connection.dispose();
  });
});

describe("Placement opened target", () => {
  afterEach(leaveAll);

  test("remembers an offline target for the next offline launch but not a server one", () => {
    const placement = place(new EditorLaunch(new AssetId("map")));
    function remembered(): string | null {
      return localStorage.getItem(`${LAST_OPENED_STORAGE_PREFIX}voxelmap`);
    }

    placement.rememberOpened(placedSession());
    assert.equal(remembered(), null);

    placement.rememberOpened(placedSession(kOffline));
    assert.equal(remembered(), "map");
  });
});

describe("Placement state report", () => {
  afterEach(leaveAll);

  test("reports the current editor state then every change to the shell until left", () => {
    const posted: unknown[] = [];
    const shell = new ShellChannel({
      port: { postMessage: (message) => posted.push(message) },
      origin: "http://studio.test"
    });
    const page = new PageState();
    page.show("booting");

    const placement = place(new EditorLaunch(new AssetId("map"), shell), page);
    page.show("ready");
    page.show("switching");
    page.show("failed");
    placement.dispose();
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
