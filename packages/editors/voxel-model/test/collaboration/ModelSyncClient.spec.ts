// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";
import type {
  VoxelModelNetworkCommand,
  VoxelModelSnapshot
} from "@jolly-pixel/asset.voxel-model/network/client.ts";

// Import Internal Dependencies
import { ModelSyncClient } from "#src/collaboration/ModelSyncClient.ts";
import type { VoxelModelRoom } from "#src/collaboration/types.ts";
import {
  ModelDocument,
  type ModelChange
} from "#src/model/index.ts";

// CONSTANTS
const kTransform = {
  position: { x: 1, y: 2, z: 3 },
  pivotOffset: { x: 0, y: 0, z: 0 },
  size: { x: 1, y: 1, z: 1 },
  scale: { x: 1, y: 1, z: 1 },
  rotation: { x: 0, y: 0, z: 0 }
};

interface MockRoom extends VoxelModelRoom {
  sentCommands: VoxelModelNetworkCommand[];
  simulateCommand(command: VoxelModelNetworkCommand): void;
  simulateSnapshot(snapshot: VoxelModelSnapshot): void;
  listenerCount(type: string): number;
}

function createMockRoom(
  clientId = "client-A"
): MockRoom {
  const sentCommands: VoxelModelNetworkCommand[] = [];
  const listeners = new Map<string, Set<(payload: unknown) => void>>();

  function emit(
    type: string,
    payload: unknown
  ): void {
    for (const listener of listeners.get(type) ?? []) {
      listener(payload);
    }
  }

  return {
    id: "test-room",
    clientId,
    peers: new Map(),
    role: "default",
    rights: {},
    access: "write" as const,
    can: () => "write" as const,
    sentCommands,
    on: (type, listener) => {
      const set = listeners.get(type) ?? new Set();
      set.add(listener as (payload: unknown) => void);
      listeners.set(type, set);
    },
    off: (type, listener) => {
      listeners.get(type)?.delete(listener as (payload: unknown) => void);
    },
    join: () => void 0,
    send: (command) => {
      sentCommands.push(command);
    },
    updatePresence: () => void 0,
    leave: () => void 0,
    simulateCommand(command) {
      emit("message", { type: "command", data: command });
    },
    simulateSnapshot(snapshot) {
      emit("message", { type: "snapshot", data: snapshot });
    },
    listenerCount(type) {
      return listeners.get(type)?.size ?? 0;
    }
  };
}

function createHarness() {
  const room = createMockRoom();
  const document = new ModelDocument(new THREE.Scene());
  const client = new ModelSyncClient({ room, document });

  return { room, document, client };
}

function header(
  clientId: string
) {
  return {
    clientId,
    seq: 1,
    timestamp: 0
  };
}

describe("ModelSyncClient — local edits", () => {
  it("sends a stamped command for each local block and folder edit", () => {
    const { room, document } = createHarness();

    const block = document.blocks.add({ name: "Block" });
    const folderId = document.folders.add({ name: "Folder" });

    assert.deepEqual(
      room.sentCommands.map((command) => [command.action, command.clientId]),
      [
        ["group-added", "client-A"],
        ["folder-added", "client-A"]
      ]
    );
    assert.equal(room.sentCommands[0].action === "group-added" && room.sentCommands[0].uuid, block.uuid);
    assert.equal(room.sentCommands[1].action === "folder-added" && room.sentCommands[1].uuid, folderId);
  });

  it("stops sending once destroyed", () => {
    const { room, document, client } = createHarness();

    client.destroy();
    document.blocks.add();

    assert.deepEqual(room.sentCommands, []);
    assert.equal(room.listenerCount("message"), 0);
  });
});

describe("ModelSyncClient — snapshot", () => {
  it("rebuilds blocks, folders and placements in one reset without sending", () => {
    const { room, document } = createHarness();
    document.blocks.add({ name: "Stale" });
    room.sentCommands.length = 0;
    let resets = 0;
    document.on("reset", () => resets++);

    room.simulateSnapshot({
      nodes: [
        { uuid: "child", name: "Child", parentUuid: "root", ...kTransform },
        { uuid: "root", name: "Root", parentUuid: null, ...kTransform }
      ],
      folders: [{ uuid: "f1", name: "Folder", parentId: null }],
      placements: [{ blockUuid: "root", folderId: "f1" }]
    });

    assert.equal(resets, 1);
    assert.deepEqual([...document.blocks.values()].map((block) => block.name), ["Child", "Root"]);
    assert.equal(document.blocks.parentOf("child"), "root");
    assert.equal(document.folders.placements.get("root"), "f1");
    assert.deepEqual(room.sentCommands, []);
  });

  it("flips ready once a snapshot is applied", () => {
    const { room, client } = createHarness();
    let readyCount = 0;
    client.on("ready", () => readyCount++);

    room.simulateSnapshot({ nodes: [], folders: [], placements: [] });

    assert.equal(client.ready, true);
    assert.equal(readyCount, 1);
  });
});

describe("ModelSyncClient — remote commands", () => {
  it("applies remote block and folder commands without re-sending them", () => {
    const { room, document } = createHarness();
    const changes: ModelChange[] = [];
    document.on("change", (change) => changes.push(change));

    room.simulateCommand({
      action: "group-added",
      uuid: "remote",
      name: "Remote",
      transform: kTransform,
      ...header("client-B")
    });
    room.simulateCommand({
      action: "folder-added",
      uuid: "f1",
      name: "Folder",
      parentId: null,
      ...header("client-B")
    });

    assert.ok(document.blocks.get("remote"));
    assert.ok(document.folders.has("f1"));
    assert.deepEqual(changes.map((change) => change.origin), ["remote", "remote"]);
    assert.deepEqual(room.sentCommands, []);
  });

  it("ignores a command that echoes back the local client's own id", () => {
    const { room, document } = createHarness();

    room.simulateCommand({
      action: "group-added",
      uuid: "echo",
      name: "Echo",
      transform: kTransform,
      ...header("client-A")
    });

    assert.equal(document.blocks.get("echo"), undefined);
  });
});
