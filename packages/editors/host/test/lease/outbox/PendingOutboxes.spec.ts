// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { IDBFactory } from "fake-indexeddb";
import type { NetworkCommandHeader } from "@jolly-pixel/network/client";

// Import Internal Dependencies
import { PendingOutboxes } from "#src/lease/outbox/PendingOutboxes.ts";

async function page(
  indexedDB: IDBFactory
): Promise<PendingOutboxes> {
  const outboxes = await PendingOutboxes.open({ indexedDB });
  assert.ok(outboxes);

  return outboxes;
}

function command(
  seq: number
): NetworkCommandHeader {
  return {
    clientId: "A",
    seq,
    timestamp: 0
  };
}

async function keepInVersionOne(
  indexedDB: IDBFactory,
  room: string,
  commands: NetworkCommandHeader[]
): Promise<void> {
  const request = indexedDB.open("jolly-pixel:pending-changes", 1);
  request.onupgradeneeded = () => {
    request.result.createObjectStore("commands", {
      keyPath: "id",
      autoIncrement: true
    });
  };
  const database = await new Promise<IDBDatabase>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  const transaction = database.transaction("commands", "readwrite");
  for (const kept of commands) {
    transaction.objectStore("commands").add({
      room,
      owner: "closed-page",
      command: kept
    });
  }
  await new Promise((resolve) => {
    transaction.oncomplete = resolve;
  });
  database.close();
}

describe("PendingOutboxes", () => {
  test("a later page claims, in order, the commands a closed page still kept", async() => {
    const indexedDB = new IDBFactory();
    const closed = await page(indexedDB);
    const room = closed.open("pixelart:tex");
    const [first, second, third] = [command(1), command(2), command(3)];
    room.keep(first);
    room.keep(second);
    room.keep(third);
    closed.open("voxelmap:map").keep(command(9));
    room.drop(first);
    assert.deepEqual(closed.open("pixelart:tex").restore(), [second, third]);
    await closed.close();

    const later = await page(indexedDB);

    assert.deepEqual(
      later.open("pixelart:tex").restore(),
      [command(2), command(3)]
    );
    assert.deepEqual((await page(indexedDB)).open("pixelart:tex").restore(), []);
  });

  test("keeps one copy per command, updated by each later keep", async() => {
    const indexedDB = new IDBFactory();
    const closed = await page(indexedDB);
    const kept = {
      clientId: "A",
      seq: 0,
      timestamp: 0
    };
    const room = closed.open("pixelart:tex");
    room.keep(kept);
    kept.seq = 4;
    room.keep(kept);
    kept.seq = 9;
    await closed.close();

    assert.deepEqual(
      (await page(indexedDB)).open("pixelart:tex").restore(),
      [command(4)]
    );
  });

  test("claims and drops the commands a page kept before the ref index", async() => {
    const indexedDB = new IDBFactory();
    await keepInVersionOne(indexedDB, "pixelart:tex", [command(1), command(2)]);

    const upgraded = await page(indexedDB);
    const room = upgraded.open("pixelart:tex");
    const [first, second] = room.restore();
    assert.deepEqual([first, second], [command(1), command(2)]);
    room.drop(first);
    await upgraded.close();

    assert.deepEqual(
      (await page(indexedDB)).open("pixelart:tex").restore(),
      [command(2)]
    );
  });
});
