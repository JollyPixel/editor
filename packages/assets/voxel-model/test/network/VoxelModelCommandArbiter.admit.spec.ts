// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  VoxelModelCommandArbiter,
  type VoxelModelArbiterState
} from "#src/network/VoxelModelCommandArbiter.ts";
import type { VoxelModelNetworkCommand } from "#src/network/types.ts";
import { TRANSFORM, networkCommand } from "../helpers/commands.ts";

// CONSTANTS
const kAcceptAll: VoxelModelArbiterState = {
  accepts: () => true
};

function admitted(
  arbiter: VoxelModelCommandArbiter,
  command: VoxelModelNetworkCommand,
  state = kAcceptAll
): VoxelModelNetworkCommand | null {
  return arbiter.admit(state, command)?.command ?? null;
}

function commit(
  arbiter: VoxelModelCommandArbiter,
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

describe("VoxelModelCommandArbiter.admit / commit", () => {
  it("rejects a command the state does not accept", () => {
    const arbiter = new VoxelModelCommandArbiter();

    assert.equal(
      admitted(arbiter, transformed(), { accepts: () => false }),
      null
    );
  });

  it("accepts the first command for a key", () => {
    const arbiter = new VoxelModelCommandArbiter();
    const command = transformed();

    assert.equal(admitted(arbiter, command), command);
  });

  it("accepts a later timestamp and rejects an earlier one, per key", () => {
    const arbiter = new VoxelModelCommandArbiter();
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
    const arbiter = new VoxelModelCommandArbiter();
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
    const arbiter = new VoxelModelCommandArbiter();
    commit(arbiter, transformed("a", { clientId: "A", timestamp: 900 }));

    const other = transformed("b", { clientId: "B", timestamp: 100 });

    assert.notEqual(admitted(arbiter, other), null);
  });

  it("never conflicts a rename with a transform of the same node", () => {
    const arbiter = new VoxelModelCommandArbiter();
    commit(arbiter, transformed("x", { clientId: "A", timestamp: 900 }));

    const renamed = networkCommand({
      action: "node-renamed",
      id: "x",
      name: "X"
    }, { clientId: "B", timestamp: 100 });

    assert.notEqual(admitted(arbiter, renamed), null);
  });

  it("settles two concurrent moves of one node as a whole", () => {
    const arbiter = new VoxelModelCommandArbiter();
    commit(arbiter, moved("x", ["x"], { clientId: "A", timestamp: 900 }));

    assert.equal(
      admitted(arbiter, moved("x", ["x"], { clientId: "B", timestamp: 500 })),
      null
    );
  });

  it("rejects a stale move that rewrites a freshly transformed block", () => {
    const arbiter = new VoxelModelCommandArbiter();
    commit(arbiter, transformed("arm", { clientId: "A", timestamp: 900 }));

    assert.equal(
      admitted(arbiter, moved("folder", ["arm"], { clientId: "B", timestamp: 500 })),
      null
    );
  });

  it("settles material changes per surface field", () => {
    const arbiter = new VoxelModelCommandArbiter();
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
    const arbiter = new VoxelModelCommandArbiter();
    const removed = networkCommand({
      action: "node-removed",
      id: "node-1"
    }, { clientId: "A", timestamp: 1 });

    assert.notEqual(admitted(arbiter, removed), null);
    commit(arbiter, removed);
    assert.notEqual(admitted(arbiter, removed), null);
  });
});

describe("VoxelModelCommandArbiter.restore", () => {
  it("records a past rename, so an older replay of it loses", () => {
    const arbiter = new VoxelModelCommandArbiter();
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
