// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type {
  FolderNodeJSON,
  FolderPlacementJSON,
  VoxelModelNetworkCommand
} from "@jolly-pixel/asset.voxel-model/network/client.ts";

// Import Internal Dependencies
import { FolderSyncClient } from "#src/network/FolderSyncClient.ts";
import FolderManager from "#src/features/folders/FolderManager.ts";
import type { VoxelModelRoom } from "#src/network/types.ts";

interface FolderSnapshotJSON {
  folders: FolderNodeJSON[];
  placements: FolderPlacementJSON[];
}

interface MockRoom extends VoxelModelRoom {
  sentCommands: VoxelModelNetworkCommand[];
  simulateCommand(cmd: VoxelModelNetworkCommand): void;
  simulateSnapshot(snapshot: FolderSnapshotJSON): void;
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
      emit("message", {
        type: "snapshot",
        data: {
          nodes: [],
          ...snapshot
        }
      });
    }
  };

  return room;
}

describe("FolderSyncClient — construction", () => {
  it("sets folderManager.onFolderUpdated", () => {
    const manager = new FolderManager();
    const room = createMockRoom();
    new FolderSyncClient({ room, folderManager: manager });

    assert.notEqual(manager.onFolderUpdated, undefined);
  });

  it("sends a stamped command when a local mutation fires the hook", () => {
    const manager = new FolderManager();
    const room = createMockRoom("client-A");
    new FolderSyncClient({ room, folderManager: manager });

    manager.addFolder({ name: "Buildings" });

    assert.equal(room.sentCommands.length, 1);
    const [cmd] = room.sentCommands;
    assert.equal(cmd.action, "folder-added");
    assert.equal(cmd.clientId, "client-A");
    assert.equal(typeof cmd.seq, "number");
    assert.equal(typeof cmd.timestamp, "number");
  });
});

describe("FolderSyncClient — snapshot", () => {
  it("rebuilds folders and placements from a snapshot", () => {
    const manager = new FolderManager();
    const room = createMockRoom();
    new FolderSyncClient({ room, folderManager: manager });

    room.simulateSnapshot({
      folders: [{ uuid: "f1", name: "Buildings", parentId: null }],
      placements: [{ blockUuid: "block-1", folderId: "f1" }]
    });

    assert.ok(manager.hasFolder("f1"));
    assert.equal(manager.getFolderOf("block-1"), "f1");
  });

  it("does not send commands while rebuilding from a snapshot", () => {
    const manager = new FolderManager();
    const room = createMockRoom();
    new FolderSyncClient({ room, folderManager: manager });

    room.simulateSnapshot({
      folders: [{ uuid: "f1", name: "A", parentId: null }],
      placements: []
    });

    assert.equal(room.sentCommands.length, 0);
  });

  it("replaces whatever folders already existed locally", () => {
    const manager = new FolderManager();
    const room = createMockRoom();
    new FolderSyncClient({ room, folderManager: manager });
    manager.addFolder({ name: "Stale" });

    room.simulateSnapshot({
      folders: [{ uuid: "fresh", name: "Fresh", parentId: null }],
      placements: []
    });

    assert.equal(manager.getFolders().size, 1);
    assert.equal(manager.getFolders().get("fresh")?.name, "Fresh");
  });

  it("flips ready and emits it once a snapshot is applied", () => {
    const manager = new FolderManager();
    const room = createMockRoom();
    const client = new FolderSyncClient({ room, folderManager: manager });

    let readyCount = 0;
    client.on("ready", () => readyCount++);

    assert.equal(client.ready, false);
    room.simulateSnapshot({ folders: [], placements: [] });

    assert.equal(client.ready, true);
    assert.equal(readyCount, 1);
  });
});

describe("FolderSyncClient — remote commands", () => {
  it("applies a remote command without re-sending it", () => {
    const manager = new FolderManager();
    const room = createMockRoom("client-A");
    new FolderSyncClient({ room, folderManager: manager });

    room.simulateCommand({
      action: "folder-added",
      uuid: "remote-uuid",
      name: "Buildings",
      parentId: null,
      clientId: "client-B",
      seq: 1,
      timestamp: 1000
    });

    assert.ok(manager.hasFolder("remote-uuid"));
    assert.equal(room.sentCommands.length, 0);
  });

  it("ignores a command that echoes back the local client's own id", () => {
    const manager = new FolderManager();
    const room = createMockRoom("client-A");
    new FolderSyncClient({ room, folderManager: manager });

    room.simulateCommand({
      action: "folder-added",
      uuid: "echo-uuid",
      name: "Buildings",
      parentId: null,
      clientId: "client-A",
      seq: 1,
      timestamp: 1000
    });

    assert.equal(manager.hasFolder("echo-uuid"), false);
  });

  it("notifies the local (pre-construction) handler so UI observers still see the change", () => {
    const manager = new FolderManager();
    const room = createMockRoom("client-A");
    const seen: string[] = [];
    manager.onFolderUpdated = (event) => seen.push(event.action);

    new FolderSyncClient({ room, folderManager: manager });

    room.simulateCommand({
      action: "folder-added",
      uuid: "remote-uuid",
      name: "Buildings",
      parentId: null,
      clientId: "client-B",
      seq: 1,
      timestamp: 1000
    });

    assert.deepEqual(seen, ["folder-added"]);
  });
});
