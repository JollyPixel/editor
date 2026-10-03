// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  CATALOG_ROOM,
  CatalogClient
} from "@jolly-pixel/asset-server/client";

// Import Internal Dependencies
import {
  ConnectionHandoff,
  ParkedConnection
} from "#src/workspace/shared-tab/ConnectionHandoff.ts";
import { FakeClient } from "../../helpers/rooms.ts";

function parked() {
  const client = new FakeClient();
  const catalog = new CatalogClient(client.room(CATALOG_ROOM));

  return {
    client,
    catalog,
    connection: new ParkedConnection(
      {
        identity: {
          username: "guest",
          peerId: "peer-guest",
          color: "#00ff00"
        },
        client
      },
      catalog
    ),
    released: () => client.destroyed && client.fakeRoom(CATALOG_ROOM).leaves === 1
  };
}

describe("ConnectionHandoff", () => {
  it("hands the parked connection and its catalog to the first take only", async() => {
    const handoff = new ConnectionHandoff();
    const first = parked();

    handoff.park(first.connection);
    const taken = handoff.take();

    assert.strictEqual(taken?.client, first.client);
    assert.strictEqual(await taken?.openCatalog?.(first.client, {}), first.catalog);
    assert.strictEqual(handoff.take(), undefined);
    assert.strictEqual(first.released(), false);
  });

  it("releases a connection parked over another one", () => {
    const handoff = new ConnectionHandoff();
    const first = parked();
    const second = parked();

    handoff.park(first.connection);
    handoff.park(second.connection);

    assert.strictEqual(first.released(), true);
    assert.strictEqual(handoff.take()?.client, second.client);
  });

  it("releases a connection parked after a take or close", () => {
    const taken = new ConnectionHandoff();
    const closed = new ConnectionHandoff();
    const late = parked();
    const kept = parked();
    const afterClose = parked();

    taken.take();
    taken.park(late.connection);
    closed.park(kept.connection);
    closed.close();
    closed.park(afterClose.connection);

    assert.strictEqual(late.released(), true);
    assert.strictEqual(kept.released(), true);
    assert.strictEqual(afterClose.released(), true);
  });
});
