// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";
import { setImmediate } from "node:timers/promises";

// Import Third-party Dependencies
import { AssetId } from "@jolly-pixel/asset";
import {
  CATALOG_ROOM,
  CatalogClient,
  CatalogUnavailableError
} from "@jolly-pixel/asset-server/client";

// Import Internal Dependencies
import { EditorLaunch } from "#src/launch/EditorLaunch.ts";
import { CATALOG_TIMEOUT_MS } from "#src/connection/openCatalog.ts";
import type { ServerConnection } from "#src/connection/ConnectionStatus.ts";
import { SessionConnection } from "#src/session/SessionConnection.ts";
import {
  MAP,
  PEER_IDENTITY,
  fakeConnection
} from "../helpers/session/connection.ts";
import {
  FakeClient,
  fakeDocumentKind,
  snapshotMessage
} from "../helpers/rooms.ts";

const kServerLink: ServerConnection = {
  ready: true,
  on: () => undefined,
  off: () => undefined
};

function mapLaunch(
  tag: string | null = null
): EditorLaunch {
  return new EditorLaunch(new AssetId("map")).viewing(tag);
}

describe("SessionConnection.connect", () => {
  test("gives up on the catalog of a server link in time and closes its client", async(t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const client = new FakeClient();
    const connecting = SessionConnection.connect({
      identity: PEER_IDENTITY,
      client,
      server: kServerLink
    });
    await setImmediate();
    t.mock.timers.tick(CATALOG_TIMEOUT_MS);

    await assert.rejects(connecting, CatalogUnavailableError);
    assert.strictEqual(client.destroyed, true);
  });

  test("shows the connection status of a server link only", async() => {
    for (const server of [kServerLink, undefined]) {
      const client = new FakeClient();
      const connecting = SessionConnection.connect({
        identity: PEER_IDENTITY,
        client,
        server
      });
      client.fakeRoom(CATALOG_ROOM).receive(snapshotMessage([MAP], {}));
      const connection = await connecting;

      assert.equal(connection.connectionStatus !== null, server !== undefined);
      connection.dispose();
    }
  });

  test("uses the catalog its opener resolves without opening another", async() => {
    const client = new FakeClient();
    const opening = CatalogClient.connect(client);
    client.fakeRoom(CATALOG_ROOM).receive(snapshotMessage([MAP], {}));
    const catalog = await opening;

    const connection = await SessionConnection.connect({
      identity: PEER_IDENTITY,
      client,
      openCatalog: () => Promise.resolve(catalog)
    });

    assert.strictEqual(connection.catalog, catalog);
    assert.strictEqual(client.fakeRoom(CATALOG_ROOM).joins, 1);
    connection.dispose();
  });

  test("closes the client when its catalog opener rejects", async() => {
    const client = new FakeClient();
    const failure = new Error("no catalog");

    await assert.rejects(
      SessionConnection.connect({
        identity: PEER_IDENTITY,
        client,
        openCatalog: () => Promise.reject(failure)
      }),
      failure
    );
    assert.strictEqual(client.destroyed, true);
  });
});

describe("SessionConnection sessions", () => {
  test("keeps the dependencies two sessions share joined until both leave", async() => {
    const kind = fakeDocumentKind("pixelart");
    const { client, connection } = await fakeConnection({
      dependencies: {
        map: [{ id: "grass", kind: "pixelart" }]
      }
    });
    const target = {
      accepts: "voxelmap",
      kinds: [kind]
    };
    const opening = connection.openSession({
      ...target,
      launch: mapLaunch()
    });
    kind.resolveAll();
    const current = await opening;

    const tagged = await connection.openSession({
      ...target,
      launch: mapLaunch("v1")
    });
    current.dispose();

    assert.equal(tagged.target.room, client.fakeRoom("voxelmap@v1:map"));
    assert.equal(client.fakeRoom("voxelmap:map").leaves, 1);
    assert.equal(kind.documents.length, 1);
    assert.equal(kind.documents[0].disposed, false);

    tagged.dispose();
    assert.equal(kind.documents[0].disposed, true);
    assert.equal(client.destroyed, false);
    connection.dispose();
  });

  test("dispose leaves every room and destroys the client", async() => {
    const kind = fakeDocumentKind("voxelmap");
    const { client, connection } = await fakeConnection();
    const opening = connection.openSession({
      launch: mapLaunch(),
      accepts: "voxelmap",
      kinds: [kind]
    });
    kind.resolveAll();
    await opening;

    connection.dispose();

    assert.equal(kind.documents[0].disposed, true);
    assert.equal(client.fakeRoom("voxelmap:map").leaves, 1);
    assert.equal(client.destroyed, true);
  });
});
