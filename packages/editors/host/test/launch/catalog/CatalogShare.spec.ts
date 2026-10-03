// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";
import { setTimeout } from "node:timers/promises";

// Import Third-party Dependencies
import { once } from "@openally/emitt";
import {
  CATALOG_APPLIED,
  CATALOG_REJECTED,
  CATALOG_RENAME,
  CATALOG_ROOM,
  CatalogClient,
  CatalogRejectedError,
  CatalogUnavailableError,
  type CatalogCommand
} from "@jolly-pixel/asset-server/client";

// Import Internal Dependencies
import { CatalogShare } from "#src/launch/catalog/CatalogShare.ts";
import { ShellCatalog } from "#src/launch/catalog/ShellCatalog.ts";
import {
  FakeClient,
  changedMessage,
  record,
  snapshotMessage
} from "../../helpers/rooms.ts";

async function sharedCatalog() {
  const client = new FakeClient();
  const opening = CatalogShare.open(client);
  const room = client.fakeRoom(CATALOG_ROOM);
  room.receive(snapshotMessage(
    [record("map", "voxelmap")],
    { map: [{ id: "grass", kind: "pixelart" }] }
  ));
  const share = await opening;
  const connector = new MessageChannel();
  const stop = share.serve(connector.port1);
  const shell = new ShellCatalog(connector.port2);

  return {
    room,
    stop,
    open: () => CatalogClient.connect(shell, { timeoutMs: 1_000 }),
    [Symbol.dispose]: () => {
      stop();
      share.dispose();
      connector.port2.close();
    }
  };
}

async function sentCommand(
  sent: unknown[]
): Promise<CatalogCommand> {
  while (sent.length === 0) {
    await setTimeout(1);
  }

  return sent.shift() as CatalogCommand;
}

describe("CatalogShare.open", () => {
  test("destroys the client when the catalog does not answer in time", async() => {
    const client = new FakeClient();

    await assert.rejects(
      CatalogShare.open(client, { timeoutMs: 1 }),
      CatalogUnavailableError
    );
    assert.strictEqual(client.destroyed, true);
  });
});

describe("CatalogShare + ShellCatalog", () => {
  test("a frame catalog opens on the shell catalog state", async() => {
    using shared = await sharedCatalog();

    const frame = await shared.open();

    assert.deepEqual(frame.record("map"), record("map", "voxelmap"));
    assert.deepEqual(
      frame.dependencies.toJSON(),
      { map: [{ id: "grass", kind: "pixelart" }] }
    );
    assert.strictEqual(shared.room.joins, 1);
    frame.dispose();
  });

  test("relays catalog changes to the frame", async() => {
    using shared = await sharedCatalog();
    const frame = await shared.open();

    const changed = once(frame, "change");
    shared.room.receive(changedMessage("grass", record("grass", "pixelart")));
    await changed;

    assert.deepEqual(frame.record("grass"), record("grass", "pixelart"));
    frame.dispose();
  });

  test("sends frame commands through the shell room and routes the reply back", async() => {
    using shared = await sharedCatalog();
    const frame = await shared.open();

    const renaming = frame.rename("map", "world.voxelmap");
    const command = await sentCommand(shared.room.sent);
    assert.strictEqual(command.type, CATALOG_RENAME);
    shared.room.receive({
      type: CATALOG_APPLIED,
      requestId: command.requestId,
      command: CATALOG_RENAME,
      assetId: "map"
    });
    await renaming;

    const removing = frame.remove("map");
    const removal = await sentCommand(shared.room.sent);
    shared.room.receive({
      type: CATALOG_REJECTED,
      requestId: removal.requestId,
      command: removal.type,
      reason: "denied"
    });
    await assert.rejects(removing, CatalogRejectedError);
    frame.dispose();
  });

  test("stopping a launch port stops relaying to its catalogs", async() => {
    using shared = await sharedCatalog();
    const frame = await shared.open();

    shared.stop();
    shared.room.receive(changedMessage("grass", record("grass", "pixelart")));
    await setTimeout(10);

    assert.strictEqual(frame.record("grass"), undefined);
    frame.dispose();
  });
});
