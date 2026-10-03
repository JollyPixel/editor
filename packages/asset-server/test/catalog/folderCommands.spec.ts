// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type * as EventStore from "@jolly-pixel/event-store";
import type { RoomContext } from "@jolly-pixel/network";

// Import Internal Dependencies
import {
  CatalogExtension,
  CatalogProjection,
  CATALOG_APPLIED,
  CATALOG_CREATE_FOLDER,
  CATALOG_DELETE_FOLDER,
  CATALOG_FOLDERS,
  CATALOG_MOVE_FOLDER,
  CATALOG_REJECTED,
  type CatalogCommand
} from "#src/index.ts";
import {
  catalogBackend,
  syncHarness,
  type SyncHarness
} from "../helpers/backend.ts";
import { bytes } from "../helpers/bytes.ts";

// CONSTANTS
const kActor: EventStore.Actor = {
  type: "user",
  id: "alice"
};

interface FolderCommands extends AsyncDisposable {
  readonly sync: SyncHarness;
  readonly broadcasts: unknown[];
  readonly replies: unknown[];
  send(command: CatalogCommand): Promise<void>;
}

async function folderCommands(): Promise<FolderCommands> {
  const sync = await syncHarness();
  const projection = new CatalogProjection({
    eventStore: sync.eventStore
  });
  projection.load();
  projection.start();

  const extension = new CatalogExtension({
    backend: catalogBackend(sync, projection)
  });
  const broadcasts: unknown[] = [];
  const replies: unknown[] = [];
  const context: RoomContext = {
    room: {
      broadcast: (payload) => broadcasts.push(payload),
      sendTo: (_clientId, payload) => replies.push(payload)
    },
    identity: {
      subject: "alice-subject",
      role: "default"
    }
  };
  extension.onClientConnect(
    {
      id: "A",
      send: () => void 0
    },
    {
      clientId: "A",
      identity: context.identity,
      profile: {},
      presence: {}
    },
    context
  );

  return {
    sync,
    broadcasts,
    replies,
    send: (command) => extension.onMessage("A", command, context),
    async [Symbol.asyncDispose]() {
      extension.dispose();
      projection.close();
      await sync[Symbol.asyncDispose]();
    }
  };
}

describe("catalog folder commands", () => {
  test("create-folder makes an empty folder and broadcasts the folder list", async() => {
    await using commands = await folderCommands();

    await commands.send({
      type: CATALOG_CREATE_FOLDER,
      requestId: "r1",
      path: "maps/draft"
    });

    assert.deepEqual(await commands.sync.source.folders(), [
      "maps",
      "maps/draft"
    ]);
    assert.deepEqual(commands.broadcasts.at(-1), {
      type: CATALOG_FOLDERS,
      folders: ["maps", "maps/draft"]
    });
    assert.deepEqual(commands.replies.at(-1), {
      type: CATALOG_APPLIED,
      requestId: "r1",
      command: CATALOG_CREATE_FOLDER,
      path: "maps/draft"
    });
  });

  test("delete-folder waits for pending projections before removing it", async() => {
    await using commands = await folderCommands();
    const created = (await commands.sync.writer.create({
      path: "maps/overworld.json",
      data: bytes("{}"),
      actor: kActor
    })).unwrap();
    await commands.sync.projector.flush();
    await commands.sync.writer.remove({
      assetId: created.assetId,
      actor: kActor
    });

    await commands.send({
      type: CATALOG_DELETE_FOLDER,
      requestId: "r2",
      path: "maps"
    });

    assert.deepEqual(await commands.sync.source.folders(), []);
    assert.deepEqual(commands.broadcasts.at(-1), {
      type: CATALOG_FOLDERS,
      folders: []
    });
    assert.deepEqual(commands.replies.at(-1), {
      type: CATALOG_APPLIED,
      requestId: "r2",
      command: CATALOG_DELETE_FOLDER,
      path: "maps"
    });
  });

  test("move-folder recreates the empty folders at the target", async() => {
    await using commands = await folderCommands();
    await commands.sync.source.createFolder("maps/draft");

    await commands.send({
      type: CATALOG_MOVE_FOLDER,
      requestId: "r4",
      from: "maps",
      to: "levels/maps"
    });

    assert.deepEqual(await commands.sync.source.folders(), [
      "levels",
      "levels/maps",
      "levels/maps/draft"
    ]);
    assert.deepEqual(commands.replies.at(-1), {
      type: CATALOG_APPLIED,
      requestId: "r4",
      command: CATALOG_MOVE_FOLDER,
      path: "levels/maps"
    });
  });

  test("rejects a folder escaping the project root", async() => {
    await using commands = await folderCommands();

    await commands.send({
      type: CATALOG_CREATE_FOLDER,
      requestId: "r3",
      path: "../outside"
    });

    assert.strictEqual(
      (commands.replies.at(-1) as { type: string; }).type,
      CATALOG_REJECTED
    );
    assert.deepEqual(await commands.sync.source.folders(), []);
  });
});
