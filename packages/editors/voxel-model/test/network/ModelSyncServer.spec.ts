// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type { RoomContext, RoomEventStoreHandle } from "@jolly-pixel/network";

// Import Internal Dependencies
import { ModelSyncServer } from "#src/network/ModelSyncServer.ts";
import type { ModelNetworkCommand, ModelServerMessage } from "#src/network/types.ts";

interface MockClient {
  id: string;
  received: ModelServerMessage[];
  send(data: unknown): void;
}

function createClient(
  id: string
): MockClient {
  const received: ModelServerMessage[] = [];

  return {
    id,
    received,
    send(data) {
      received.push(data as ModelServerMessage);
    }
  };
}

const unusedEventStore: RoomEventStoreHandle = {
  append: () => Promise.resolve(true),
  list: () => Promise.resolve([])
};

function roomContext(
  deliver: (payload: unknown) => void = () => void 0
): RoomContext {
  return {
    room: {
      broadcast: deliver,
      sendTo: (_clientId, payload) => deliver(payload)
    },
    eventStore: unusedEventStore
  };
}

const noopRoom = roomContext();

function observe(
  server: ModelSyncServer,
  client: MockClient
): RoomContext {
  server.onClientConnect(client);

  return roomContext((payload) => client.send(payload));
}

const kTransform = {
  position: { x: 0, y: 0, z: 0 },
  pivotOffset: { x: 0, y: 0, z: 0 },
  size: { x: 1, y: 1, z: 1 },
  scale: { x: 1, y: 1, z: 1 },
  rotation: { x: 0, y: 0, z: 0 }
};

type AddedCommand = Extract<ModelNetworkCommand, { action: "group-added"; }>;

function addedCmd(
  overrides: Partial<Omit<AddedCommand, "action">> = {}
): AddedCommand {
  return {
    action: "group-added",
    uuid: "group-1",
    name: "Torso",
    transform: kTransform,
    clientId: "client-A",
    seq: 1,
    timestamp: 1000,
    ...overrides
  };
}

describe("ModelSyncServer — snapshot", () => {
  it("is empty for a freshly constructed server", () => {
    const server = new ModelSyncServer();
    assert.deepEqual(server.snapshot(), []);
  });

  it("reflects an applied group-added", () => {
    const server = new ModelSyncServer();
    server.receive(addedCmd(), noopRoom);

    const snap = server.snapshot();
    assert.equal(snap.length, 1);
    assert.equal(snap[0].uuid, "group-1");
    assert.equal(snap[0].name, "Torso");
    assert.equal(snap[0].parentUuid, null);
  });
});

describe("ModelSyncServer — onClientConnect", () => {
  it("sends a snapshot to the newly connected client", () => {
    const server = new ModelSyncServer();
    const client = createClient("A");
    server.onClientConnect(client);

    assert.equal(client.received.length, 1);
    assert.equal(client.received[0].type, "snapshot");
  });
});

describe("ModelSyncServer — receive: apply + broadcast", () => {
  it("broadcasts an applied command to observing clients", () => {
    const server = new ModelSyncServer();
    const client = createClient("A");
    const room = observe(server, client);
    client.received.length = 0;

    server.receive(addedCmd(), room);

    assert.equal(client.received.length, 1);
    const msg = client.received[0];
    assert.equal(msg.type, "command");
    assert.equal((msg as { data: ModelNetworkCommand; }).data.action, "group-added");
  });

  it("renames a group that already exists", () => {
    const server = new ModelSyncServer();
    server.receive(addedCmd(), noopRoom);

    server.receive({
      action: "group-renamed",
      uuid: "group-1",
      name: "Arm",
      clientId: "client-A",
      seq: 2,
      timestamp: 1001
    }, noopRoom);

    assert.equal(server.snapshot()[0].name, "Arm");
  });

  it("drops a mutation targeting a uuid that doesn't exist", () => {
    const server = new ModelSyncServer();
    const client = createClient("A");
    const room = observe(server, client);
    client.received.length = 0;

    server.receive({
      action: "group-renamed",
      uuid: "missing",
      name: "Arm",
      clientId: "client-A",
      seq: 1,
      timestamp: 1000
    }, room);

    assert.equal(client.received.length, 0);
  });

  it("removes a group", () => {
    const server = new ModelSyncServer();
    server.receive(addedCmd(), noopRoom);

    server.receive({
      action: "group-removed",
      uuid: "group-1",
      clientId: "client-A",
      seq: 2,
      timestamp: 1001
    }, noopRoom);

    assert.deepEqual(server.snapshot(), []);
  });
});

describe("ModelSyncServer — receive: LWW conflict resolution", () => {
  it("rejects a stale transform and does not broadcast it", () => {
    const server = new ModelSyncServer();
    server.receive(addedCmd(), noopRoom);

    const client = createClient("A");
    const room = observe(server, client);
    client.received.length = 0;

    server.receive({
      action: "group-transformed",
      uuid: "group-1",
      transform: { ...kTransform, position: { x: 9, y: 0, z: 0 } },
      clientId: "client-A",
      seq: 2,
      timestamp: 2000
    }, room);
    client.received.length = 0;

    server.receive({
      action: "group-transformed",
      uuid: "group-1",
      transform: { ...kTransform, position: { x: 1, y: 0, z: 0 } },
      clientId: "client-B",
      seq: 1,
      timestamp: 500
    }, room);

    assert.equal(client.received.length, 0);
    assert.equal(server.snapshot()[0].position.x, 9);
  });
});

describe("ModelSyncServer — id", () => {
  it("defaults to \"voxel-model\", overridable per instance", () => {
    assert.equal(new ModelSyncServer().id, "voxel-model");
    assert.equal(new ModelSyncServer({ id: "voxel-model:2" }).id, "voxel-model:2");
  });

  it("exposes a stable extension name, for rights-table namespacing", () => {
    assert.equal(new ModelSyncServer().name, "voxel-model");
  });
});
