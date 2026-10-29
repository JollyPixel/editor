// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as EventStore from "@jolly-pixel/event-store";
import { FilesystemAssetSource } from "@jolly-pixel/asset-source/node";
import { Server } from "@jolly-pixel/network";

// Import Internal Dependencies
import {
  createAssetBackend,
  encodeContent,
  CATALOG_APPLIED,
  CATALOG_CREATE,
  CATALOG_REJECTED,
  CATALOG_ROOM
} from "#src/index.ts";
import { tempDirectory } from "./helpers/tempDirectory.ts";
import { bytes } from "./helpers/bytes.ts";
import { recordingClient } from "./helpers/rooms.ts";

describe("asset-server — end to end", () => {
  test("catalog.maxContentBytes caps catalog:create payloads", async() => {
    await using directory = await tempDirectory();
    await using eventStore = EventStore.persistence.memory();

    await using backend = await createAssetBackend({
      source: new FilesystemAssetSource(directory.root),
      eventStore,
      reconcile: {
        watch: false
      },
      catalog: {
        maxContentBytes: 4
      }
    });
    const server = new Server();
    backend.attach(server);

    const author = recordingClient("A");
    const connectionA = server.connect(author, { subject: author.id, role: "default" });
    await connectionA.receive({ room: CATALOG_ROOM, kind: "join" });

    for (const [path, content] of [["small.bin", "1234"], ["large.bin", "12345"]]) {
      await connectionA.receive({
        room: CATALOG_ROOM,
        kind: "message",
        payload: {
          type: CATALOG_CREATE,
          requestId: path,
          path,
          content: encodeContent(bytes(content))
        }
      });
    }
    await backend.flush();

    const replies = author.received
      .map((message) => (message as { payload?: { type: string; requestId?: string; }; }).payload)
      .filter((payload) => payload?.requestId !== undefined);
    assert.deepEqual(
      replies.map((payload) => [payload?.requestId, payload?.type]),
      [
        ["small.bin", CATALOG_APPLIED],
        ["large.bin", CATALOG_REJECTED]
      ]
    );

    await server.close();
  });
});
