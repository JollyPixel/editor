// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { supersedes } from "#src/sync/supersedes.ts";
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

describe("supersedes — no existing command", () => {
  test("wins when nothing has been written yet", () => {
    assert.strictEqual(supersedes(header(), undefined), true);
  });
});

describe("supersedes — different clients", () => {
  test("wins with a strictly newer timestamp", () => {
    const existing = header({ clientId: "A", timestamp: 500 });
    const incoming = header({ clientId: "B", timestamp: 900 });
    assert.strictEqual(supersedes(incoming, existing), true);
  });

  test("loses with a strictly older timestamp", () => {
    const existing = header({ clientId: "A", timestamp: 900 });
    const incoming = header({ clientId: "B", timestamp: 500 });
    assert.strictEqual(supersedes(incoming, existing), false);
  });

  test("on a timestamp tie, the lexicographically greater clientId wins", () => {
    const existing = header({ clientId: "A", timestamp: 500 });

    assert.strictEqual(
      supersedes(header({ clientId: "B", timestamp: 500 }), existing),
      true
    );
    assert.strictEqual(
      supersedes(header({ clientId: "0", timestamp: 500 }), existing),
      false
    );
  });
});

describe("supersedes — same client (undo/redo replay ordering)", () => {
  test("wins even when the incoming timestamp is older than the existing one", () => {
    const existing = header({ clientId: "A", timestamp: 2000 });
    const incoming = header({ clientId: "A", timestamp: 500 });

    assert.strictEqual(supersedes(incoming, existing), true);
  });

  test("wins with an equal timestamp", () => {
    const existing = header({ clientId: "A", timestamp: 1000 });
    const incoming = header({ clientId: "A", timestamp: 1000 });

    assert.strictEqual(supersedes(incoming, existing), true);
  });
});

describe("supersedes — server order", () => {
  test("a fresh write beats an existing versioned write whatever its timestamp", () => {
    assert.strictEqual(supersedes(
      header({ clientId: "B", timestamp: 1 }),
      { ...header({ clientId: "A", timestamp: 9_000 }), version: 4 }
    ), true);
  });

  test("a replay wins only when its basis is not older than the existing version", () => {
    const existing = { ...header({ clientId: "A" }), version: 7 };

    assert.strictEqual(supersedes(header({ clientId: "B", basis: 7 }), existing), true);
    assert.strictEqual(supersedes(header({ clientId: "B", basis: 5 }), existing), false);
    assert.strictEqual(supersedes(header({ clientId: "A", basis: 5 }), existing), true);
  });
});
