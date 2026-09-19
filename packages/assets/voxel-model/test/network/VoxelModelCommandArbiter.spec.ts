// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { VoxelModelCommandArbiter } from "#src/network/VoxelModelCommandArbiter.ts";
import type { VoxelModelNetworkCommand } from "#src/network/types.ts";
import {
  TRANSFORM,
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
  uuid = "group-1",
  overrides: Parameters<typeof networkCommand>[1] = {}
): VoxelModelNetworkCommand {
  return networkCommand({
    action: "group-transformed",
    uuid,
    transform: TRANSFORM
  }, overrides);
}

describe("VoxelModelCommandArbiter.key", () => {
  const cases: [VoxelModelNetworkCommand, string | null][] = [
    [transformed(), "group:group-1"],
    [
      networkCommand({
        action: "group-renamed",
        uuid: "group-1",
        name: "X"
      }),
      "group:group-1"
    ],
    [
      networkCommand({
        action: "group-reparented",
        uuid: "group-1",
        parentUuid: null,
        transform: TRANSFORM
      }),
      "group:group-1"
    ],
    [
      networkCommand({
        action: "group-reparented-local",
        uuid: "group-1",
        parentUuid: null
      }),
      "group:group-1"
    ],
    [
      networkCommand({
        action: "folder-renamed",
        uuid: "folder-1",
        name: "X"
      }),
      "folder:folder-1"
    ],
    [
      networkCommand({
        action: "folder-reparented",
        uuid: "folder-1",
        parentId: null
      }),
      "folder:folder-1"
    ],
    [
      networkCommand({
        action: "block-placed",
        blockUuid: "block-1",
        folderId: "folder-1"
      }),
      "placement:block-1"
    ],
    [
      networkCommand({
        action: "block-unplaced",
        blockUuid: "block-1"
      }),
      "placement:block-1"
    ],
    [networkCommand({ action: "group-added", uuid: "g", name: "g", transform: TRANSFORM }), null],
    [networkCommand({ action: "group-removed", uuid: "g" }), null],
    [
      networkCommand({
        action: "folder-added",
        uuid: "f",
        name: "f",
        parentId: null
      }),
      null
    ],
    [networkCommand({ action: "folder-removed", uuid: "f" }), null]
  ];

  for (const [command, expected] of cases) {
    it(`keys ${command.action} as ${String(expected)}`, () => {
      assert.equal(VoxelModelCommandArbiter.key(command), expected);
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
    const first = transformed("group-1", { clientId: "A", timestamp: 900 });
    const later = transformed("group-1", { clientId: "B", timestamp: 1500 });
    const stale = transformed("group-1", { clientId: "C", timestamp: 500 });

    assert.notEqual(admitted(arbiter, first), null);
    commit(arbiter, first);

    assert.notEqual(admitted(arbiter, later), null);
    commit(arbiter, later);

    assert.equal(admitted(arbiter, stale), null);
  });

  it("never conflicts across different uuids", () => {
    const arbiter = new VoxelModelCommandArbiter();
    commit(arbiter, transformed("a", { clientId: "A", timestamp: 900 }));

    const other = transformed("b", { clientId: "B", timestamp: 100 });

    assert.notEqual(admitted(arbiter, other), null);
  });

  it("never conflicts across group, folder and placement namespaces", () => {
    const arbiter = new VoxelModelCommandArbiter();
    commit(arbiter, transformed("x", { clientId: "A", timestamp: 900 }));

    const folder = networkCommand({
      action: "folder-renamed",
      uuid: "x",
      name: "X"
    }, { clientId: "B", timestamp: 100 });
    const placement = networkCommand({
      action: "block-placed",
      blockUuid: "x",
      folderId: "f"
    }, { clientId: "C", timestamp: 100 });

    assert.notEqual(admitted(arbiter, folder), null);
    commit(arbiter, folder);
    assert.notEqual(admitted(arbiter, placement), null);
  });

  it("always admits unarbitrated actions regardless of prior state", () => {
    const arbiter = new VoxelModelCommandArbiter();
    const removed = networkCommand({
      action: "group-removed",
      uuid: "group-1"
    }, { clientId: "A", timestamp: 1 });

    assert.notEqual(admitted(arbiter, removed), null);
    commit(arbiter, removed);
    assert.notEqual(admitted(arbiter, removed), null);
  });
});
