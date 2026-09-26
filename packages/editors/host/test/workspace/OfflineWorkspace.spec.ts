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
  OfflineWorkspace,
  type OfflineWorkspaceOptions
} from "#src/workspace/offline/OfflineWorkspace.ts";
import { editorHandle } from "../helpers/editorHandle.ts";

// CONSTANTS
const kAssetId = "offline-asset";

function openWorkspace(
  options: Partial<OfflineWorkspaceOptions> = {}
): Promise<OfflineWorkspace> {
  return OfflineWorkspace.open({
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
  workspace: OfflineWorkspace,
  target: string
): MountStandaloneOptions {
  return {
    sources: [
      {
        read: () => Promise.resolve(EditorLaunch.fromTarget(target))
      }
    ],
    connect: () => workspace.connect()
  };
}

describe("OfflineWorkspace", () => {
  test("applies the backend tuning to the catalog room", async() => {
    const workspace = await openWorkspace({
      backend: {
        catalogArchiveLimits: { maxEntryBytes: 4 }
      }
    });
    const { client } = workspace.connect();
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
      await workspace.close();
    }
  });

  test("keeps serving clients until the last connection is destroyed", async() => {
    const workspace = await openWorkspace();
    const first = workspace.connect();
    const second = workspace.connect();

    first.client.destroy();
    first.client.destroy();
    const third = workspace.connect();
    const room = second.client.room("test-room");
    room.join();
    room.leave();

    second.client.destroy();
    third.client.destroy();
    await workspace.close();
    assert.throws(() => workspace.connect(), /closing/);
  });

  test("mounts an editor on the seeded target without a username prompt", async() => {
    const workspace = await openWorkspace();
    const contexts: EditorContext[] = [];

    const handle = await mountStandalone({
      accepts: BINARY_KIND,
      identity: { title: "never prompted" },
      kinds: [],
      mount: (context) => {
        contexts.push(context);

        return Promise.resolve(editorHandle(context.session));
      }
    }, offlineOptions(workspace, kAssetId));

    const [{ session }] = contexts;
    assert.equal(session.target.record.id, kAssetId);
    assert.equal(session.target.record.source, "notes/readme.bin");
    assert.equal(session.identity.username, "Guest");

    handle.dispose();
    await workspace.close();
  });

  test("creates assets through the in-page catalog", async() => {
    const workspace = await openWorkspace();
    const contexts: EditorContext[] = [];

    const handle = await mountStandalone({
      accepts: BINARY_KIND,
      identity: { title: "never prompted" },
      kinds: [],
      mount: (context) => {
        contexts.push(context);

        return Promise.resolve(editorHandle(context.session));
      }
    }, offlineOptions(workspace, kAssetId));

    const [{ session }] = contexts;
    const createdId = await session.catalog.create(
      "notes/second.bin",
      new TextEncoder().encode("second"),
      { kind: BINARY_KIND }
    );

    assert.equal(
      session.catalog.record(createdId)?.source,
      "notes/second.bin"
    );

    handle.dispose();
    await workspace.close();
  });

  test("closes the workspace when the target is unknown", async() => {
    const workspace = await openWorkspace();

    await assert.rejects(
      mountStandalone({
        accepts: BINARY_KIND,
        identity: { title: "never prompted" },
        kinds: [],
        mount: () => Promise.reject(new Error("unreachable"))
      }, offlineOptions(workspace, "missing")),
      AssetNotFoundError
    );

    await workspace.close();
  });
});
