// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { FolderCommandArbiter } from "#src/network/FolderCommandArbiter.ts";
import type { FolderNetworkCommand } from "#src/network/folderTypes.ts";

function admitted(
  arbiter: FolderCommandArbiter,
  command: FolderNetworkCommand
): FolderNetworkCommand | null {
  return arbiter.admit(command)?.command ?? null;
}

function commit(
  arbiter: FolderCommandArbiter,
  command: FolderNetworkCommand
): void {
  arbiter.admit(command)!.commit();
}

type RenamedCommand = Extract<FolderNetworkCommand, { action: "folder-renamed"; }>;

function renamedCmd(
  overrides: Partial<Omit<RenamedCommand, "action">> = {}
): RenamedCommand {
  return {
    action: "folder-renamed",
    uuid: "folder-1",
    name: "X",
    clientId: "client-A",
    seq: 1,
    timestamp: 1000,
    ...overrides
  };
}

describe("FolderCommandArbiter.key", () => {
  it("keys folder-renamed and folder-reparented by folder uuid", () => {
    assert.equal(FolderCommandArbiter.key(renamedCmd()), "folder:folder-1");
    assert.equal(
      FolderCommandArbiter.key({
        action: "folder-reparented",
        uuid: "folder-1",
        parentId: null,
        clientId: "a",
        seq: 1,
        timestamp: 1
      }),
      "folder:folder-1"
    );
  });

  it("keys block-placed and block-unplaced by block uuid", () => {
    assert.equal(
      FolderCommandArbiter.key({
        action: "block-placed",
        blockUuid: "block-1",
        folderId: "folder-1",
        clientId: "a",
        seq: 1,
        timestamp: 1
      }),
      "placement:block-1"
    );
    assert.equal(
      FolderCommandArbiter.key({
        action: "block-unplaced",
        blockUuid: "block-1",
        clientId: "a",
        seq: 1,
        timestamp: 1
      }),
      "placement:block-1"
    );
  });

  it("does not key folder-added or folder-removed (unarbitrated)", () => {
    assert.equal(
      FolderCommandArbiter.key({
        action: "folder-added",
        uuid: "folder-1",
        name: "X",
        parentId: null,
        clientId: "a",
        seq: 1,
        timestamp: 1
      }),
      null
    );
    assert.equal(
      FolderCommandArbiter.key({
        action: "folder-removed",
        uuid: "folder-1",
        clientId: "a",
        seq: 1,
        timestamp: 1
      }),
      null
    );
  });
});

describe("FolderCommandArbiter.admit / commit", () => {
  it("accepts the first command for a key", () => {
    const arbiter = new FolderCommandArbiter();
    const cmd = renamedCmd();

    assert.equal(admitted(arbiter, cmd), cmd);
  });

  it("accepts a later timestamp and rejects an earlier one, per folder uuid", () => {
    const arbiter = new FolderCommandArbiter();
    const first = renamedCmd({ clientId: "A", timestamp: 900 });
    const later = renamedCmd({ clientId: "B", timestamp: 1500 });
    const stale = renamedCmd({ clientId: "C", timestamp: 500 });

    assert.notEqual(admitted(arbiter, first), null);
    commit(arbiter, first);

    assert.notEqual(admitted(arbiter, later), null);
    commit(arbiter, later);

    assert.equal(admitted(arbiter, stale), null);
  });

  it("never conflicts across different keys (folder vs placement)", () => {
    const arbiter = new FolderCommandArbiter();
    commit(arbiter, renamedCmd({ uuid: "folder-1", timestamp: 900 }));

    const placement: FolderNetworkCommand = {
      action: "block-placed",
      blockUuid: "block-1",
      folderId: "folder-1",
      clientId: "B",
      seq: 1,
      timestamp: 100
    };

    assert.notEqual(admitted(arbiter, placement), null);
  });

  it("always admits unarbitrated actions regardless of prior state", () => {
    const arbiter = new FolderCommandArbiter();
    const removed: FolderNetworkCommand = {
      action: "folder-removed",
      uuid: "folder-1",
      clientId: "A",
      seq: 1,
      timestamp: 1
    };

    assert.notEqual(admitted(arbiter, removed), null);
    commit(arbiter, removed);
    assert.notEqual(admitted(arbiter, removed), null);
  });
});
