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

describe("ConflictTracker — no prior command at a key", () => {
  test("accepts", () => {
    const tracker = new ConflictTracker(new LastWriteWinsResolver());
    assert.strictEqual(tracker.resolve("k", header()), "accept");
  });
});

describe("ConflictTracker — resolve reads recorded commands per key", () => {
  test("a later timestamp at the same key is accepted", () => {
    const tracker = new ConflictTracker(new LastWriteWinsResolver());

    const first = header({ clientId: "A", timestamp: 500 });
    tracker.resolve("k", first);
    tracker.record("k", first);

    assert.strictEqual(
      tracker.resolve("k", header({ clientId: "B", timestamp: 900 })),
      "accept"
    );
  });

  test("a stale timestamp at the same key is rejected", () => {
    const tracker = new ConflictTracker(new LastWriteWinsResolver());

    const first = header({ clientId: "A", timestamp: 900 });
    tracker.resolve("k", first);
    tracker.record("k", first);

    assert.strictEqual(
      tracker.resolve("k", header({ clientId: "B", timestamp: 500 })),
      "reject"
    );
  });

  test("different keys are tracked independently", () => {
    const tracker = new ConflictTracker(new LastWriteWinsResolver());

    const first = header({ clientId: "A", timestamp: 900 });
    tracker.resolve("k1", first);
    tracker.record("k1", first);

    assert.strictEqual(
      tracker.resolve("k2", header({ clientId: "B", timestamp: 100 })),
      "accept"
    );
  });
});

describe("ConflictTracker — record", () => {
  test("a command not recorded is not remembered by resolve()", () => {
    const tracker = new ConflictTracker(new LastWriteWinsResolver());

    // Resolved (and would be accepted) but deliberately never recorded —
    // mirrors a command that was accepted by the resolver but failed to
    // apply downstream, so it must not poison later resolutions at the key.
    tracker.resolve("k", header({ clientId: "A", timestamp: 900 }));

    assert.strictEqual(
      tracker.resolve("k", header({ clientId: "B", timestamp: 100 })),
      "accept"
    );
  });

  test("is a no-op for a null key", () => {
    const tracker = new ConflictTracker(new LastWriteWinsResolver());

    tracker.record(null, header({ clientId: "A", timestamp: 900 }));

    assert.strictEqual(
      tracker.resolve(null, header({ clientId: "B", timestamp: 100 })),
      "accept"
    );
  });
});

describe("ConflictTracker — null key", () => {
  test("always resolves against no history", () => {
    const tracker = new ConflictTracker(new LastWriteWinsResolver());

    const first = header({ clientId: "A", timestamp: 900 });
    tracker.resolve(null, first);
    tracker.record(null, first);

    assert.strictEqual(
      tracker.resolve(null, header({ clientId: "B", timestamp: 100 })),
      "accept"
    );
  });
});
