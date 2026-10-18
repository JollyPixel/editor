// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { indexedDB } from "fake-indexeddb";
import { BINARY_KIND } from "@jolly-pixel/asset-server";
import type * as EventStore from "@jolly-pixel/event-store";

// Import Internal Dependencies
import { OfflineWorkspace } from "#src/workspace/offline/OfflineWorkspace.ts";
import { PeerInvites } from "#src/workspace/peer/PeerInvites.ts";

// CONSTANTS
const kAssetId = "notes";
const kActor: EventStore.Actor = {
  type: "user",
  id: "guest"
};

Object.assign(globalThis, { indexedDB });

function openOwner(
  databaseName: string
): Promise<OfflineWorkspace> {
  return OfflineWorkspace.openOwner({
    databaseName,
    release: () => void 0,
    auth: new PeerInvites(),
    project: () => {
      return {
        handlers: [],
        seed: {
          "notes.bin": {
            id: kAssetId,
            kind: BINARY_KIND,
            content: () => new TextEncoder().encode("notes")
          }
        }
      };
    }
  });
}

function eventTypes(
  workspace: OfflineWorkspace
): string[] {
  return workspace.backend.eventStore.reader
    .list(kAssetId)
    .map((event) => event.eventType);
}

describe("OfflineWorkspace event log", () => {
  test("an edit reaches the next session although the page never closed", async() => {
    const first = await openOwner("jolly-workspace:unclosed");
    (await first.backend.writer.update({
      assetId: kAssetId,
      data: new TextEncoder().encode("edited"),
      actor: kActor
    })).unwrap();

    const second = await openOwner("jolly-workspace:unclosed");

    assert.strictEqual(eventTypes(second).at(-1), "asset.updated");
    await second.close();
    await first.close();
  });
});
