// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { KeyedCommandArbiter } from "@jolly-pixel/network";

// Import Internal Dependencies
import { voxelModelConflictKeys } from "#src/network/VoxelModelCommandKeys.ts";
import type {
  VoxelModelCommand,
  VoxelModelNetworkCommand
} from "#src/network/types.ts";
import { TRANSFORM, networkCommand } from "../helpers/commands.ts";

interface ArbiterState {
  accepts(command: VoxelModelCommand): boolean;
}

type ConflictArbiter = KeyedCommandArbiter<VoxelModelNetworkCommand, ArbiterState>;

// CONSTANTS
const kAcceptAll: ArbiterState = {
  accepts: () => true
};

function conflictArbiter(): ConflictArbiter {
  return new KeyedCommandArbiter<VoxelModelNetworkCommand, ArbiterState>({
    accepts: (state, command) => state.accepts(command),
    writes: (command) => {
      return { keys: voxelModelConflictKeys(command) };
    }
  });
}

function admitted(
  arbiter: ConflictArbiter,
  command: VoxelModelNetworkCommand,
  state = kAcceptAll
): VoxelModelNetworkCommand | null {
  return arbiter.admit(state, command)?.command ?? null;
}

function commit(
  arbiter: ConflictArbiter,
  command: VoxelModelNetworkCommand
): void {
  arbiter.admit(kAcceptAll, command)!.commit();
}

function transformed(
  id = "node-1",
  overrides: Parameters<typeof networkCommand>[1] = {}
): VoxelModelNetworkCommand {
  return networkCommand({
    action: "node-transformed",
    id,
    transform: TRANSFORM
  }, overrides);
}

function moved(
  id: string,
  transformedIds: string[],
  overrides: Parameters<typeof networkCommand>[1] = {}
): VoxelModelNetworkCommand {
  return networkCommand({
    action: "node-moved",
    id,
    parentId: null,
    transforms: transformedIds.map((transformedId) => {
      return {
        id: transformedId,
        transform: TRANSFORM
      };
    })
  }, overrides);
}

describe("voxel-model conflict keys, admit / commit", () => {
  it("accepts the first command for a key", () => {
    const arbiter = conflictArbiter();
    const command = transformed();

    assert.equal(admitted(arbiter, command), command);
  });

  it("accepts a later timestamp and rejects an earlier one, per key", () => {
    const arbiter = conflictArbiter();
    const first = transformed("node-1", { clientId: "A", timestamp: 900 });
    const later = transformed("node-1", { clientId: "B", timestamp: 1500 });
    const stale = transformed("node-1", { clientId: "C", timestamp: 500 });

    assert.notEqual(admitted(arbiter, first), null);
    commit(arbiter, first);

    assert.notEqual(admitted(arbiter, later), null);
    commit(arbiter, later);

    assert.equal(admitted(arbiter, stale), null);
  });

  it("refuses a removal based on a version older than a peer's edit of the node, as an undo is", () => {
    const arbiter = conflictArbiter();
    arbiter.admit(kAcceptAll, networkCommand({
      action: "node-renamed",
      id: "x",
      name: "X"
    }, { clientId: "A" }))!.commit(5);
    const removal = { action: "node-removed", id: "x" } as const;

    assert.equal(admitted(arbiter, networkCommand(removal, { clientId: "B", basis: 3 })), null);
    assert.notEqual(admitted(arbiter, networkCommand(removal, { clientId: "B", basis: 5 })), null);
    assert.notEqual(admitted(arbiter, networkCommand(removal, { clientId: "B" })), null);
  });

  it("never conflicts across different ids", () => {
    const arbiter = conflictArbiter();
    commit(arbiter, transformed("a", { clientId: "A", timestamp: 900 }));

    const other = transformed("b", { clientId: "B", timestamp: 100 });

    assert.notEqual(admitted(arbiter, other), null);
  });

  it("never conflicts a rename with a transform of the same node", () => {
    const arbiter = conflictArbiter();
    commit(arbiter, transformed("x", { clientId: "A", timestamp: 900 }));

    const renamed = networkCommand({
      action: "node-renamed",
      id: "x",
      name: "X"
    }, { clientId: "B", timestamp: 100 });

    assert.notEqual(admitted(arbiter, renamed), null);
  });

  it("settles two concurrent moves of one node as a whole", () => {
    const arbiter = conflictArbiter();
    commit(arbiter, moved("x", ["x"], { clientId: "A", timestamp: 900 }));

    assert.equal(
      admitted(arbiter, moved("x", ["x"], { clientId: "B", timestamp: 500 })),
      null
    );
  });

  it("rejects a stale move that rewrites a freshly transformed block", () => {
    const arbiter = conflictArbiter();
    commit(arbiter, transformed("arm", { clientId: "A", timestamp: 900 }));

    assert.equal(
      admitted(arbiter, moved("folder", ["arm"], { clientId: "B", timestamp: 500 })),
      null
    );
  });

  it("settles material changes per surface field", () => {
    const arbiter = conflictArbiter();
    commit(arbiter, networkCommand({
      action: "material-changed",
      id: "glass",
      surface: { roughness: 0.2 }
    }, { clientId: "A", timestamp: 900 }));

    const otherField = networkCommand({
      action: "material-changed",
      id: "glass",
      surface: { opacity: 0.5 }
    }, { clientId: "B", timestamp: 500 });
    const sameField = networkCommand({
      action: "material-changed",
      id: "glass",
      surface: { roughness: 0.8 }
    }, { clientId: "B", timestamp: 500 });

    assert.notEqual(admitted(arbiter, otherField), null);
    assert.equal(admitted(arbiter, sameField), null);
  });

  it("always admits unarbitrated actions regardless of prior state", () => {
    const arbiter = conflictArbiter();
    const removed = networkCommand({
      action: "node-removed",
      id: "node-1"
    }, { clientId: "A", timestamp: 1 });

    assert.notEqual(admitted(arbiter, removed), null);
    commit(arbiter, removed);
    assert.notEqual(admitted(arbiter, removed), null);
  });
});

describe("voxel-model conflict keys, restore", () => {
  it("records a past rename, so an older replay of it loses", () => {
    const arbiter = conflictArbiter();
    arbiter.restore(
      networkCommand({ action: "node-renamed", id: "a", name: "B" }, { clientId: "client-B" }),
      9
    );

    assert.strictEqual(
      arbiter.admit(kAcceptAll, networkCommand(
        { action: "node-renamed", id: "a", name: "C" },
        { clientId: "client-A", basis: 8 }
      )),
      null
    );
  });
});
