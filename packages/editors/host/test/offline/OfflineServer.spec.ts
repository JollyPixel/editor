// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { BINARY_KIND } from "@jolly-pixel/asset-server";
import {
  CATALOG_ROOM,
  CatalogClient
} from "@jolly-pixel/asset-server/client";
import { AssetNotFoundError } from "@jolly-pixel/asset";

// Import Internal Dependencies
import {
  mountStandalone,
  type MountStandaloneOptions
} from "#src/editor/mountStandalone.ts";
import type { EditorContext } from "#src/editor/EditorDefinition.ts";
import { EditorLaunch } from "#src/launch/EditorLaunch.ts";
import {
  OfflineServer,
  type OfflineServerOptions
} from "#src/offline/server/OfflineServer.ts";
import { editorHandle } from "../helpers/editorHandle.ts";

// CONSTANTS
const kAssetId = "offline-asset";

function openServer(
  options: Partial<OfflineServerOptions> = {}
): Promise<OfflineServer> {
  return OfflineServer.open({
    ...options,
    handlers: [],
    seed: {
      "notes/readme.bin": {
        id: kAssetId,
        kind: BINARY_KIND,
        content: () => new TextEncoder().encode("hello")
      }
    }
  });
}

function offlineOptions(
  server: OfflineServer,
  target: string
): MountStandaloneOptions {
  return {
    sources: [
      {
        read: () => Promise.resolve(EditorLaunch.fromTarget(target))
      }
    ],
    connect: () => server.connect()
  };
}

describe("OfflineServer", () => {
  test("applies the backend tuning to the catalog room", async() => {
    const server = await openServer({
      backend: {
        catalog: {
          archiveLimits: {
            maxEntryBytes: 4
          }
        }
      }
    });
    const { client } = server.connect();
    const catalog = new CatalogClient(client.room(CATALOG_ROOM));
    try {
      await catalog.ready;
      const archive = await catalog.exportArchive(kAssetId);

      await assert.rejects(
        catalog.planImport(archive),
        /exceeds 4 bytes/
      );
    }
    finally {
      catalog.dispose();
      client.destroy();
      await server.close();
    }
  });

  test("keeps serving clients until the last connection is destroyed", async() => {
    const server = await openServer();
    const first = server.connect();
    const second = server.connect();

    first.client.destroy();
    first.client.destroy();
    const third = server.connect();
    const room = second.client.room("test-room");
    room.join();
    room.leave();

    second.client.destroy();
    third.client.destroy();
    await server.close();
    assert.throws(() => server.connect(), /closing/);
  });

  test("mounts an editor on the seeded target without a username prompt", async() => {
    const server = await openServer();
    const contexts: EditorContext[] = [];

    const editor = await mountStandalone({
      accepts: BINARY_KIND,
      identity: { title: "never prompted" },
      kinds: [],
      mount: (context) => {
        contexts.push(context);

        return Promise.resolve(editorHandle(context.session));
      }
    }, offlineOptions(server, kAssetId));

    const [{ session }] = contexts;
    assert.equal(session.target.record.id, kAssetId);
    assert.equal(session.target.record.path, "notes/readme.bin");
    assert.equal(session.identity.username, "Guest");

    editor.dispose();
    await server.close();
  });

  test("creates assets through the in-page catalog", async() => {
    const server = await openServer();
    const contexts: EditorContext[] = [];

    const editor = await mountStandalone({
      accepts: BINARY_KIND,
      identity: { title: "never prompted" },
      kinds: [],
      mount: (context) => {
        contexts.push(context);

        return Promise.resolve(editorHandle(context.session));
      }
    }, offlineOptions(server, kAssetId));

    const [{ session }] = contexts;
    const createdId = await session.catalog.create(
      "notes/second.bin",
      new TextEncoder().encode("second"),
      { kind: BINARY_KIND }
    );

    assert.equal(
      session.catalog.record(createdId)?.path,
      "notes/second.bin"
    );

    editor.dispose();
    await server.close();
  });

  test("closes the server when the target is unknown", async() => {
    const server = await openServer();

    await assert.rejects(
      mountStandalone({
        accepts: BINARY_KIND,
        identity: { title: "never prompted" },
        kinds: [],
        mount: () => Promise.reject(new Error("unreachable"))
      }, offlineOptions(server, "missing")),
      AssetNotFoundError
    );

    await server.close();
  });
});
