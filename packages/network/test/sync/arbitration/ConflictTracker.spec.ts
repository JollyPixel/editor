// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { ConflictTracker } from "#src/sync/arbitration/ConflictTracker.ts";
import type { NetworkCommandHeader } from "#src/index.ts";

function header(
  overrides: Partial<NetworkCommandHeader> = {}
): NetworkCommandHeader {
  return {
    clientId: "A",
    seq: 1,
    timestamp: 1000,
    ...overrides
  };
}

function admitsAll(
  conflicts: ConflictTracker,
  command: NetworkCommandHeader,
  keys: readonly string[]
): boolean {
  return conflicts.admit(command, keys).indices.length === keys.length;
}

function commit(
  conflicts: ConflictTracker,
  command: NetworkCommandHeader,
  keys: readonly string[],
  version?: number
): void {
  const admission = conflicts.admit(command, keys);
  assert.strictEqual(admission.indices.length, keys.length);
  admission.commit(version);
}

describe("ConflictTracker.admit", () => {
  test("admits every key with no history", () => {
    assert.deepStrictEqual(
      new ConflictTracker().admit(header(), ["k", "j"]).indices,
      [0, 1]
    );
  });

  test("returns the indices of the keys that accept", () => {
    const conflicts = new ConflictTracker();
    commit(conflicts, header({ timestamp: 900 }), ["b"]);

    const { indices } = conflicts.admit(
      header({ clientId: "B", timestamp: 500 }),
      ["a", "b", "c"]
    );

    assert.deepStrictEqual(indices, [0, 2]);
  });

  test("commit records only the accepted keys", () => {
    const conflicts = new ConflictTracker();
    commit(conflicts, header({ timestamp: 900 }), ["b"]);

    conflicts.admit(
      header({ clientId: "B", timestamp: 500 }),
      ["a", "b"]
    ).commit();

    assert.strictEqual(admitsAll(conflicts, header({ clientId: "C", timestamp: 700 }), ["b"]), false);
    assert.strictEqual(admitsAll(conflicts, header({ clientId: "C", timestamp: 400 }), ["a"]), false);
  });

  test("an uncommitted admission leaves no history", () => {
    const conflicts = new ConflictTracker();
    conflicts.admit(header({ timestamp: 900 }), ["k"]);

    assert.strictEqual(admitsAll(conflicts, header({ clientId: "B", timestamp: 100 }), ["k"]), true);
  });
});

describe("ConflictTracker.reset", () => {
  test("forgets every key and resolves unseen keys against the reset command", () => {
    const conflicts = new ConflictTracker();
    commit(conflicts, header({ timestamp: 900 }), ["k"]);

    conflicts.reset(header({ clientId: "R", timestamp: 500 }));

    assert.strictEqual(admitsAll(conflicts, header({ clientId: "B", timestamp: 600 }), ["k"]), true);
    assert.strictEqual(admitsAll(conflicts, header({ clientId: "B", timestamp: 400 }), ["other"]), false);
  });
});

describe("ConflictTracker versions", () => {
  test("commit records the version the command landed at", () => {
    const conflicts = new ConflictTracker();
    commit(conflicts, header(), ["k"], 12);

    assert.strictEqual(admitsAll(conflicts, header({ clientId: "B", basis: 11 }), ["k"]), false);
    assert.strictEqual(admitsAll(conflicts, header({ clientId: "B", basis: 12 }), ["k"]), true);
  });

  test("a replay older than a versioned reset is rejected", () => {
    const conflicts = new ConflictTracker();

    conflicts.reset(header({ clientId: "R" }), 20);

    assert.strictEqual(admitsAll(conflicts, header({ clientId: "B", timestamp: 1 }), ["k"]), true);
    assert.strictEqual(admitsAll(conflicts, header({ clientId: "B", basis: 3 }), ["k"]), false);
  });

  test("record restores a key without an admission", () => {
    const conflicts = new ConflictTracker();

    conflicts.record(header({ clientId: "A" }), ["k"], 8);

    assert.strictEqual(admitsAll(conflicts, header({ clientId: "B", basis: 2 }), ["k"]), false);
    assert.strictEqual(admitsAll(conflicts, header({ clientId: "B", basis: 8 }), ["k"]), true);
  });
});
