// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { VoxelModelCommandArbiter } from "#src/network/VoxelModelCommandArbiter.ts";
import type { VoxelModelNetworkCommand } from "#src/network/types.ts";
import {
  TRANSFORM,
  blockAdded,
  networkCommand
} from "../helpers/commands.ts";

function admitted(
  arbiter: VoxelModelCommandArbiter,
  command: VoxelModelNetworkCommand
): VoxelModelNetworkCommand | null {
  return arbiter.admit(command)?.command ?? null;
}

function commit(
  arbiter: VoxelModelCommandArbiter,
  command: VoxelModelNetworkCommand
): void {
  arbiter.admit(command)!.commit();
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

describe("VoxelModelCommandArbiter.keys", () => {
  const cases: [VoxelModelNetworkCommand, string[]][] = [
    [transformed(), ["transform:node-1"]],
    [
      networkCommand({
        action: "node-renamed",
        id: "node-1",
        name: "X"
      }),
      ["name:node-1"]
    ],
    [
      moved("folder-1", ["a", "b"]),
      ["parent:folder-1", "transform:a", "transform:b"]
    ],
    [networkCommand(blockAdded("n")), []],
    [networkCommand({ action: "node-removed", id: "n" }), []]
  ];

  for (const [command, expected] of cases) {
    it(`keys ${command.action} as [${expected.join(", ")}]`, () => {
      assert.deepEqual(VoxelModelCommandArbiter.keys(command), expected);
    });
  }
});

describe("VoxelModelCommandArbiter.admit / commit", () => {
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
