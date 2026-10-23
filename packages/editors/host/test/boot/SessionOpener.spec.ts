// Import Node.js Dependencies
import {
  afterEach,
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";
import { setImmediate } from "node:timers/promises";

// Import Third-party Dependencies
import { AssetId } from "@jolly-pixel/asset";
import { CATALOG_ROOM } from "@jolly-pixel/asset-server/client";

// Import Internal Dependencies
import { SessionOpener } from "#src/boot/SessionOpener.ts";
import type { EditorDefinition, EditorHandle } from "#src/boot/EditorDefinition.ts";
import { readDebugLogger } from "#src/debug/readDebugLogger.ts";
import { CatalogShare } from "#src/shell/catalog/CatalogShare.ts";
import { ShellCatalog } from "#src/shell/catalog/ShellCatalog.ts";
import { EditorLaunch } from "#src/launch/EditorLaunch.ts";
import {
  ShellChannel,
  type LaunchIdentity
} from "#src/shell/ShellChannel.ts";
import { IDENTITY_STORAGE_KEY } from "#src/connection/server.ts";
import {
  FakeClient,
  record,
  snapshotMessage
} from "../helpers/rooms.ts";

// CONSTANTS
const kIdentity = {
  username: "alice",
  peerId: "peer-alice",
  color: "#ff0000"
};
const kDefinition: EditorDefinition<EditorHandle> = {
  accepts: "voxelmap",
  identity: { title: "Join" },
  kinds: [],
  mount: () => Promise.reject(new Error("not mounted"))
};
const kQueried = new EditorLaunch(new AssetId("map"));

afterEach(() => {
  window.history.replaceState(null, "", "/");
  sessionStorage.clear();
});

async function shellLaunch(
  identity: LaunchIdentity | null = null
) {
  const shellClient = new FakeClient();
  const opening = CatalogShare.open(shellClient);
  shellClient.fakeRoom(CATALOG_ROOM).receive(
    snapshotMessage([record("map", "voxelmap")])
  );
  const share = await opening;
  const connector = new MessageChannel();
  const stop = share.serve(connector.port1);
  const launch = new EditorLaunch(
    new AssetId("map"),
    new ShellChannel({
      port: { postMessage: () => undefined },
      origin: location.origin,
      catalog: new ShellCatalog(connector.port2),
      identity
    })
  );

  return {
    launch,
    [Symbol.dispose]: () => {
      stop();
      share.dispose();
    }
  };
}

function opener(
  client: FakeClient,
  queried?: EditorLaunch
): SessionOpener {
  return new SessionOpener({
    definition: kDefinition,
    connect: () => {
      return {
        identity: kIdentity,
        client
      };
    },
    queried,
    logger: readDebugLogger()
  });
}

describe("SessionOpener", () => {
  test("an early session takes its catalog from the shell launch", async() => {
    using shell = await shellLaunch();
    const client = new FakeClient();

    const sessions = opener(client, kQueried);
    const session = await sessions.open(shell.launch);

    assert.strictEqual(session.target.record.id, "map");
    assert.strictEqual(client.rooms.has(CATALOG_ROOM), false);
    sessions.dispose();
  });

  test("an online session joins as the launch identity, not the stored name", async() => {
    window.history.replaceState(null, "", "/?target=map");
    sessionStorage.setItem(IDENTITY_STORAGE_KEY, "bob");
    using shell = await shellLaunch({
      username: "alice",
      peerId: "peer-alice"
    });

    const sessions = new SessionOpener({
      definition: kDefinition,
      logger: readDebugLogger()
    });
    const session = await sessions.open(shell.launch);
    sessions.dispose();

    assert.equal(session.identity.username, "alice");
    assert.equal(session.identity.peerId, "peer-alice");
  });

  test("a launch without a shell catalog opens one on the client", async() => {
    const client = new FakeClient();

    const sessions = opener(client);
    const opening = sessions.open(new EditorLaunch(new AssetId("map")));
    await setImmediate();
    client.fakeRoom(CATALOG_ROOM).receive(
      snapshotMessage([record("map", "voxelmap")])
    );
    const session = await opening;

    assert.strictEqual(session.target.record.id, "map");
    sessions.dispose();
  });

  test("disposing before the launch releases the early session client", async() => {
    const client = new FakeClient();

    opener(client, kQueried).dispose();
    await setImmediate();

    assert.strictEqual(client.destroyed, true);
  });
});
