// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";
import type * as network from "@jolly-pixel/network";
import type { TransformControls } from "three/examples/jsm/controls/TransformControls.js";

// Import Internal Dependencies
import { ModelSyncClient } from "#src/network/ModelSyncClient.ts";
import ModelManager from "#src/features/groups/ModelManager.ts";
import type { ModelNetworkCommand, ModelNodeJSON, ModelServerMessage } from "#src/network/types.ts";

interface MockRoom extends network.Room<ModelNetworkCommand, ModelServerMessage> {
  sentCommands: ModelNetworkCommand[];
  simulateCommand(cmd: ModelNetworkCommand): void;
  simulateSnapshot(snapshot: ModelNodeJSON[]): void;
}

function createMockRoom(
  clientId = "client-A"
): MockRoom {
  const sentCommands: ModelNetworkCommand[] = [];
  const listeners = new Map<string, Set<(payload: unknown) => void>>();

  function emit(
    type: string,
    payload: unknown
  ): void {
    for (const listener of listeners.get(type) ?? []) {
      listener(payload);
    }
  }

  const room: MockRoom = {
    id: "test-room",
    clientId,
    peers: new Map(),
    role: "default",
    rights: {},
    access: "write" as const,
    can: () => "write" as const,
    sentCommands,
    on: (type, listener) => {
      let set = listeners.get(type);
      if (!set) {
        set = new Set();
        listeners.set(type, set);
      }
      set.add(listener as (payload: unknown) => void);
    },
    off: (type, listener) => {
      listeners.get(type)?.delete(listener as (payload: unknown) => void);
    },
    join: () => void 0,
    send: (cmd) => {
      sentCommands.push(cmd);
    },
    updatePresence: () => void 0,
    leave: () => void 0,
    simulateCommand(cmd) {
      emit("message", { type: "command", data: cmd });
    },
    simulateSnapshot(snapshot) {
      emit("message", { type: "snapshot", data: snapshot });
    }
  };

  return room;
}

function createModelManager(): ModelManager {
  const scene = new THREE.Scene();
  const transformControl = {
    attach: () => undefined,
    detach: () => undefined,
    getHelper: () => new THREE.Object3D()
  } as unknown as TransformControls;

  return new ModelManager({ scene, transformControl });
}

const kTransform = {
  position: { x: 1, y: 2, z: 3 },
  pivotOffset: { x: 0, y: 0, z: 0 },
  size: { x: 1, y: 1, z: 1 },
  scale: { x: 1, y: 1, z: 1 },
  rotation: { x: 0, y: 0, z: 0 }
};

describe("ModelSyncClient — construction", () => {
  it("sets modelManager.onModelUpdated", () => {
    const manager = createModelManager();
    const room = createMockRoom();
    new ModelSyncClient({ room, modelManager: manager });

    assert.notEqual(manager.onModelUpdated, undefined);
  });

  it("sends a stamped command when a local mutation fires the hook", () => {
    const manager = createModelManager();
    const room = createMockRoom("client-A");
    new ModelSyncClient({ room, modelManager: manager });

    manager.addGroup({ name: "Torso" });

    assert.equal(room.sentCommands.length, 1);
    const [cmd] = room.sentCommands;
    assert.equal(cmd.action, "group-added");
    assert.equal(cmd.clientId, "client-A");
    assert.equal(typeof cmd.seq, "number");
    assert.equal(typeof cmd.timestamp, "number");
  });
});

describe("ModelSyncClient — snapshot", () => {
  it("rebuilds groups at the right parent from a flat snapshot, in any order", () => {
    const manager = createModelManager();
    const room = createMockRoom();
    new ModelSyncClient({ room, modelManager: manager });

    const snapshot: ModelNodeJSON[] = [
      { uuid: "child", name: "Arm", parentUuid: "parent", ...kTransform },
      { uuid: "parent", name: "Torso", parentUuid: null, ...kTransform }
    ];
    room.simulateSnapshot(snapshot);

    const parent = manager.getGroupByUUID("parent");
    const child = manager.getGroupByUUID("child");
    assert.ok(parent);
    assert.ok(child);
    assert.equal(manager.getParentUUID("child"), "parent");
  });

  it("does not send commands while rebuilding from a snapshot", () => {
    const manager = createModelManager();
    const room = createMockRoom();
    new ModelSyncClient({ room, modelManager: manager });

    room.simulateSnapshot([
      { uuid: "a", name: "A", parentUuid: null, ...kTransform }
    ]);

    assert.equal(room.sentCommands.length, 0);
  });

  it("replaces whatever groups already existed locally", () => {
    const manager = createModelManager();
    const room = createMockRoom();
    new ModelSyncClient({ room, modelManager: manager });
    manager.addGroup({ name: "Stale" });

    room.simulateSnapshot([
      { uuid: "fresh", name: "Fresh", parentUuid: null, ...kTransform }
    ]);

    assert.equal(manager.getGroups().length, 1);
    assert.equal(manager.getGroups()[0].name, "Fresh");
  });

  it("flips ready and emits it once a snapshot is applied", () => {
    const manager = createModelManager();
    const room = createMockRoom();
    const client = new ModelSyncClient({ room, modelManager: manager });

    let readyCount = 0;
    client.on("ready", () => readyCount++);

    assert.equal(client.ready, false);
    room.simulateSnapshot([]);

    assert.equal(client.ready, true);
    assert.equal(readyCount, 1);
  });

  it("restores flipAxes for a late-joining peer, for a block mirrored before it joined", () => {
    const manager = createModelManager();
    const room = createMockRoom();
    new ModelSyncClient({ room, modelManager: manager });

    room.simulateSnapshot([
      {
        uuid: "mirrored",
        name: "Mirrored",
        parentUuid: null,
        flipAxes: { x: true, y: false, z: false },
        ...kTransform
      },
      { uuid: "plain", name: "Plain", parentUuid: null, ...kTransform }
    ]);

    assert.deepEqual(manager.getFlipAxes("mirrored"), { x: true, y: false, z: false });
    assert.equal(manager.getFlipAxes("plain"), undefined);
  });
});

describe("ModelSyncClient — remote commands", () => {
  it("applies a remote command without re-sending it", () => {
    const manager = createModelManager();
    const room = createMockRoom("client-A");
    new ModelSyncClient({ room, modelManager: manager });

    room.simulateCommand({
      action: "group-added",
      uuid: "remote-uuid",
      name: "Torso",
      transform: kTransform,
      clientId: "client-B",
      seq: 1,
      timestamp: 1000
    });

    assert.ok(manager.getGroupByUUID("remote-uuid"));
    assert.equal(room.sentCommands.length, 0);
  });

  it("ignores a command that echoes back the local client's own id", () => {
    const manager = createModelManager();
    const room = createMockRoom("client-A");
    new ModelSyncClient({ room, modelManager: manager });

    room.simulateCommand({
      action: "group-added",
      uuid: "echo-uuid",
      name: "Torso",
      transform: kTransform,
      clientId: "client-A",
      seq: 1,
      timestamp: 1000
    });

    assert.equal(manager.getGroupByUUID("echo-uuid"), undefined);
  });

  it("notifies the local (pre-construction) handler so UI observers still see the change", () => {
    const manager = createModelManager();
    const room = createMockRoom("client-A");
    const seen: string[] = [];
    manager.onModelUpdated = (event) => seen.push(event.action);

    new ModelSyncClient({ room, modelManager: manager });

    room.simulateCommand({
      action: "group-added",
      uuid: "remote-uuid",
      name: "Torso",
      transform: kTransform,
      clientId: "client-B",
      seq: 1,
      timestamp: 1000
    });

    assert.deepEqual(seen, ["group-added"]);
  });
});
