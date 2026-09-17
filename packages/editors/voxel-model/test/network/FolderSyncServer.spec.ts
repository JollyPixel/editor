// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type { RoomContext, RoomPeer } from "@jolly-pixel/network";

// Import Internal Dependencies
import { FolderSyncServer } from "#src/network/FolderSyncServer.ts";
import type { FolderNetworkCommand, FolderServerMessage } from "#src/network/folderTypes.ts";

interface MockClient {
  id: string;
  received: FolderServerMessage[];
  send(data: unknown): void;
}

function createClient(
  id: string
): MockClient {
  const received: FolderServerMessage[] = [];

  return {
    id,
    received,
    send(data) {
      received.push(data as FolderServerMessage);
    }
  };
}

function roomPeer(
  clientId: string
): RoomPeer {
  return {
    clientId,
    identity: { subject: clientId, role: "default" },
    profile: {},
    presence: {}
  };
}

function roomContext(
  deliver: (payload: unknown) => void = () => void 0
): RoomContext {
  return {
    room: {
      broadcast: deliver,
      sendTo: (_clientId, payload) => deliver(payload)
    },
    identity: { subject: "client-A", role: "default" }
  };
}

const noopRoom = roomContext();

function observe(
  server: FolderSyncServer,
  client: MockClient
): RoomContext {
  server.onClientConnect(client, roomPeer(client.id), noopRoom);

  return roomContext((payload) => client.send(payload));
}

type AddedCommand = Extract<FolderNetworkCommand, { action: "folder-added"; }>;

function addedCmd(
  overrides: Partial<Omit<AddedCommand, "action">> = {}
): AddedCommand {
  return {
    action: "folder-added",
    uuid: "folder-1",
    name: "Buildings",
    parentId: null,
    clientId: "client-A",
    seq: 1,
    timestamp: 1000,
    ...overrides
  };
}

describe("FolderSyncServer — snapshot", () => {
  it("is empty for a freshly constructed server", () => {
    const server = new FolderSyncServer();
    assert.deepEqual(server.snapshot(), { folders: [], placements: [] });
  });

  it("reflects an applied folder-added", () => {
    const server = new FolderSyncServer();
    server.receive(addedCmd(), noopRoom);

    const snap = server.snapshot();
    assert.equal(snap.folders.length, 1);
    assert.equal(snap.folders[0].uuid, "folder-1");
    assert.equal(snap.folders[0].name, "Buildings");
    assert.equal(snap.folders[0].parentId, null);
  });

  it("reflects an applied block-placed", () => {
    const server = new FolderSyncServer();
    server.receive(addedCmd(), noopRoom);
    server.receive({
      action: "block-placed",
      blockUuid: "block-1",
      folderId: "folder-1",
      clientId: "client-A",
      seq: 2,
      timestamp: 1001
    }, noopRoom);

    assert.deepEqual(server.snapshot().placements, [
      { blockUuid: "block-1", folderId: "folder-1" }
    ]);
  });
});

describe("FolderSyncServer — onClientConnect", () => {
  it("sends a snapshot to the newly connected client", () => {
    const server = new FolderSyncServer();
    const client = createClient("A");
    server.onClientConnect(client, roomPeer(client.id), noopRoom);

    assert.equal(client.received.length, 1);
    assert.equal(client.received[0].type, "snapshot");
  });
});

describe("FolderSyncServer — receive: apply + broadcast", () => {
  it("broadcasts an applied command to observing clients", () => {
    const server = new FolderSyncServer();
    const client = createClient("A");
    const room = observe(server, client);
    client.received.length = 0;

    server.receive(addedCmd(), room);

    assert.equal(client.received.length, 1);
    const msg = client.received[0];
    assert.equal(msg.type, "command");
    assert.equal((msg as { data: FolderNetworkCommand; }).data.action, "folder-added");
  });

  it("renames a folder that already exists", () => {
    const server = new FolderSyncServer();
    server.receive(addedCmd(), noopRoom);

    server.receive({
      action: "folder-renamed",
      uuid: "folder-1",
      name: "Vegetation",
      clientId: "client-A",
      seq: 2,
      timestamp: 1001
    }, noopRoom);

    assert.equal(server.snapshot().folders[0].name, "Vegetation");
  });

  it("drops a mutation targeting a folder uuid that doesn't exist", () => {
    const server = new FolderSyncServer();
    const client = createClient("A");
    const room = observe(server, client);
    client.received.length = 0;

    server.receive({
      action: "folder-renamed",
      uuid: "missing",
      name: "X",
      clientId: "client-A",
      seq: 1,
      timestamp: 1000
    }, room);

    assert.equal(client.received.length, 0);
  });

  it("removes a folder", () => {
    const server = new FolderSyncServer();
    server.receive(addedCmd(), noopRoom);

    server.receive({
      action: "folder-removed",
      uuid: "folder-1",
      clientId: "client-A",
      seq: 2,
      timestamp: 1001
    }, noopRoom);

    assert.deepEqual(server.snapshot().folders, []);
  });
});

describe("FolderSyncServer — receive: LWW conflict resolution", () => {
  it("rejects a stale rename and does not broadcast it", () => {
    const server = new FolderSyncServer();
    server.receive(addedCmd(), noopRoom);

    const client = createClient("A");
    const room = observe(server, client);
    client.received.length = 0;

    server.receive({
      action: "folder-renamed",
      uuid: "folder-1",
      name: "Newer",
      clientId: "client-A",
      seq: 2,
      timestamp: 2000
    }, room);
    client.received.length = 0;

    server.receive({
      action: "folder-renamed",
      uuid: "folder-1",
      name: "Stale",
      clientId: "client-B",
      seq: 1,
      timestamp: 500
    }, room);

    assert.equal(client.received.length, 0);
    assert.equal(server.snapshot().folders[0].name, "Newer");
  });
});

describe("FolderSyncServer — id", () => {
  it("defaults to \"voxel-model:folders\", overridable per instance", () => {
    assert.equal(new FolderSyncServer().id, "voxel-model:folders");
    assert.equal(new FolderSyncServer({ id: "voxel-model:folders:2" }).id, "voxel-model:folders:2");
  });

  it("exposes a stable extension name, for rights-table namespacing", () => {
    assert.equal(new FolderSyncServer().name, "voxel-model-folders");
  });
});
