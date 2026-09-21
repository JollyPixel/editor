// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { BINARY_KIND } from "@jolly-pixel/asset-server/backend";
import { AssetNotFoundError } from "@jolly-pixel/asset";

// Import Internal Dependencies
import {
  mountStandalone,
  type MountStandaloneOptions
} from "#src/editor/mountStandalone.ts";
import type { EditorContext } from "#src/editor/EditorDefinition.ts";
import { EditorLaunch } from "#src/launch/EditorLaunch.ts";
import { OfflineWorkspace } from "#src/session/OfflineWorkspace.ts";

// CONSTANTS
const kAssetId = "offline-asset";

function openWorkspace(): Promise<OfflineWorkspace> {
  return OfflineWorkspace.open({
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
  test("mounts an editor on the seeded target without a username prompt", async() => {
    const workspace = await openWorkspace();
    const contexts: EditorContext[] = [];

    const handle = await mountStandalone({
      accepts: BINARY_KIND,
      identity: { title: "never prompted" },
      kinds: [],
      mount: (context) => {
        contexts.push(context);

        return Promise.resolve({
          dispose: () => context.session.dispose()
        });
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

        return Promise.resolve({
          dispose: () => context.session.dispose()
        });
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
