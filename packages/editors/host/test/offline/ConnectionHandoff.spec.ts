// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { setImmediate } from "node:timers/promises";

// Import Third-party Dependencies
import { CATALOG_ROOM } from "@jolly-pixel/asset-server/client";

// Import Internal Dependencies
import { ConnectionHandoff } from "#src/offline/ConnectionHandoff.ts";
import {
  FakeClient,
  record,
  snapshotMessage
} from "../helpers/rooms.ts";

function guestHandoff() {
  const clients: FakeClient[] = [];
  const handoff = new ConnectionHandoff(() => {
    const client = new FakeClient();
    clients.push(client);

    return {
      identity: {
        username: "guest",
        peerId: "peer-guest",
        color: "#00ff00"
      },
      client
    };
  });

  return {
    handoff,
    clients,
    sync(): void {
      for (const client of clients) {
        client.fakeRoom(CATALOG_ROOM).receive(
          snapshotMessage([record("map", "voxelmap")])
        );
      }
    }
  };
}

describe("ConnectionHandoff", () => {
  for (const first of ["launch", "connect"] as const) {
    it(`shares one client and catalog when the ${first} comes first`, async() => {
      const { handoff, clients, sync } = guestHandoff();

      const reading = first === "launch" ? handoff.catalog() : null;
      const taken = handoff.take();
      const catalog = reading ?? handoff.catalog();
      sync();

      assert.equal(clients.length, 1);
      assert.strictEqual(taken.client, clients[0]);
      assert.strictEqual(
        await taken.openCatalog?.(taken.client, {}),
        await catalog
      );
    });
  }

  it("opens a client of its own for every later connect", () => {
    const { handoff, clients } = guestHandoff();

    handoff.take();
    const later = handoff.take();

    assert.equal(clients.length, 2);
    assert.strictEqual(later.client, clients[1]);
    assert.equal(later.openCatalog, undefined);
  });

  it("releases the connection of a launch read that no connect took", async() => {
    const { handoff, clients, sync } = guestHandoff();

    const catalog = handoff.catalog();
    sync();
    await catalog;
    handoff.release();
    await setImmediate();

    assert.equal(clients[0].destroyed, true);
    assert.equal(clients[0].fakeRoom(CATALOG_ROOM).leaves, 1);
  });

  it("leaves a taken connection to its taker", () => {
    const { handoff, clients } = guestHandoff();

    handoff.take();
    handoff.release();

    assert.equal(clients[0].destroyed, false);
  });
});
