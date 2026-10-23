// Import Node.js Dependencies
import {
  beforeEach,
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { deleteDB } from "idb";
import type { NetworkCommandHeader } from "@jolly-pixel/network/client";

// Import Internal Dependencies
import { PendingOutboxes } from "#src/lease/outbox/PendingOutboxes.ts";

async function page(): Promise<PendingOutboxes> {
  const outboxes = await PendingOutboxes.open();
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

describe("PendingOutboxes", () => {
  beforeEach(() => deleteDB("jolly-pixel:pending-changes"));

  test("a later page claims, in order, the commands a closed page still kept", async() => {
    const closed = await page();
    const room = closed.open("pixelart:tex");
    const [first, second, third] = [command(1), command(2), command(3)];
    room.keep(first);
    room.keep(second);
    room.keep(third);
    closed.open("voxelmap:map").keep(command(9));
    room.drop(first);
    assert.deepEqual(closed.open("pixelart:tex").restore(), [second, third]);
    await closed.close();

    const later = await page();

    assert.deepEqual(
      later.open("pixelart:tex").restore(),
      [command(2), command(3)]
    );
    assert.deepEqual((await page()).open("pixelart:tex").restore(), []);
  });

  test("keeps one copy per command, updated by each later keep", async() => {
    const closed = await page();
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
      (await page()).open("pixelart:tex").restore(),
      [command(4)]
    );
  });
});
