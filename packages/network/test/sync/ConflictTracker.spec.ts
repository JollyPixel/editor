// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  ConflictTracker,
  LastWriteWinsResolver,
  type NetworkCommandHeader
} from "#src/index.ts";

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

function tracker() {
  return new ConflictTracker(new LastWriteWinsResolver());
}

function commit(
  conflicts: ReturnType<typeof tracker>,
  command: NetworkCommandHeader,
  keys: readonly string[]
): void {
  const admission = conflicts.admit(command, keys);
  assert.ok(admission);
  admission.commit();
}

describe("ConflictTracker.admit", () => {
  test("admits a command with no history at its keys", () => {
    const command = header();

    assert.strictEqual(tracker().admit(command, ["k"])?.command, command);
  });

  test("admits a command with no keys", () => {
    const conflicts = tracker();
    commit(conflicts, header({ timestamp: 900 }), ["k"]);

    assert.notStrictEqual(
      conflicts.admit(header({ clientId: "B", timestamp: 100 }), []),
      null
    );
  });

  test("rejects when any key holds a newer command", () => {
    const conflicts = tracker();
    commit(conflicts, header({ timestamp: 900 }), ["k2"]);

    assert.strictEqual(
      conflicts.admit(header({ clientId: "B", timestamp: 500 }), ["k1", "k2"]),
      null
    );
  });

  test("keys are tracked independently", () => {
    const conflicts = tracker();
    commit(conflicts, header({ timestamp: 900 }), ["k1"]);

    assert.notStrictEqual(
      conflicts.admit(header({ clientId: "B", timestamp: 100 }), ["k2"]),
      null
    );
  });

  test("an uncommitted admission leaves no history", () => {
    const conflicts = tracker();
    conflicts.admit(header({ timestamp: 900 }), ["k"]);

    assert.notStrictEqual(
      conflicts.admit(header({ clientId: "B", timestamp: 100 }), ["k"]),
      null
    );
  });
});

describe("ConflictTracker.admitEach", () => {
  test("returns the indices of the keys that accept", () => {
    const conflicts = tracker();
    commit(conflicts, header({ timestamp: 900 }), ["b"]);

    const { indices } = conflicts.admitEach(
      header({ clientId: "B", timestamp: 500 }),
      ["a", "b", "c"]
    );

    assert.deepStrictEqual(indices, [0, 2]);
  });

  test("commit records only the accepted keys", () => {
    const conflicts = tracker();
    commit(conflicts, header({ timestamp: 900 }), ["b"]);

    conflicts.admitEach(
      header({ clientId: "B", timestamp: 500 }),
      ["a", "b"]
    ).commit();

    assert.strictEqual(
      conflicts.admit(header({ clientId: "C", timestamp: 700 }), ["b"]),
      null
    );
    assert.strictEqual(
      conflicts.admit(header({ clientId: "C", timestamp: 400 }), ["a"]),
      null
    );
  });
});

describe("ConflictTracker.reset", () => {
  test("forgets every key and resolves unseen keys against the reset command", () => {
    const conflicts = tracker();
    commit(conflicts, header({ timestamp: 900 }), ["k"]);

    conflicts.reset(header({ clientId: "R", timestamp: 500 }));

    assert.notStrictEqual(
      conflicts.admit(header({ clientId: "B", timestamp: 600 }), ["k"]),
      null
    );
    assert.strictEqual(
      conflicts.admit(header({ clientId: "B", timestamp: 400 }), ["other"]),
      null
    );
  });
});

describe("ConflictTracker resolver context", () => {
  test("passes only the header of the recorded command as existing", () => {
    const seen: unknown[] = [];
    const conflicts = new ConflictTracker({
      resolve(ctx) {
        seen.push(ctx.existing);

        return "accept";
      }
    });
    const admission = conflicts.admit(
      { ...header(), action: "paint", pixels: [1, 2, 3] },
      ["k"]
    );
    admission?.commit();

    conflicts.admit(header({ clientId: "B" }), ["k"]);

    assert.deepStrictEqual(seen, [
      undefined,
      { clientId: "A", seq: 1, timestamp: 1000 }
    ]);
  });
});
