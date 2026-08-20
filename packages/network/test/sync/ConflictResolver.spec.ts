// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
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

describe("LastWriteWinsResolver — no existing command", () => {
  test("accepts when nothing has been written yet", () => {
    const resolver = new LastWriteWinsResolver();
    assert.strictEqual(
      resolver.resolve({ incoming: header(), existing: undefined }),
      "accept"
    );
  });
});

describe("LastWriteWinsResolver — different clients", () => {
  test("accepts a strictly newer timestamp", () => {
    const resolver = new LastWriteWinsResolver();
    const existing = header({ clientId: "A", timestamp: 500 });
    const incoming = header({ clientId: "B", timestamp: 900 });
    assert.strictEqual(resolver.resolve({ incoming, existing }), "accept");
  });

  test("rejects a strictly older timestamp", () => {
    const resolver = new LastWriteWinsResolver();
    const existing = header({ clientId: "A", timestamp: 900 });
    const incoming = header({ clientId: "B", timestamp: 500 });
    assert.strictEqual(resolver.resolve({ incoming, existing }), "reject");
  });

  test("on a timestamp tie, the lexicographically greater clientId wins", () => {
    const resolver = new LastWriteWinsResolver();
    const existing = header({ clientId: "A", timestamp: 500 });

    assert.strictEqual(
      resolver.resolve({
        incoming: header({ clientId: "B", timestamp: 500 }),
        existing
      }),
      "accept"
    );
    assert.strictEqual(
      resolver.resolve({
        incoming: header({ clientId: "0", timestamp: 500 }),
        existing
      }),
      "reject"
    );
  });
});

describe("LastWriteWinsResolver — same client (undo/redo replay ordering)", () => {
  test("accepts even when the incoming timestamp is older than the existing one", () => {
    const resolver = new LastWriteWinsResolver();

    // Mirrors undo replaying two overlapping edits newest-first: the first
    // replay (of the more recent edit) lands with the newer timestamp, then
    // the second replay (of the older edit) arrives with an older one.
    const existing = header({ clientId: "A", timestamp: 2000 });
    const incoming = header({ clientId: "A", timestamp: 500 });

    assert.strictEqual(resolver.resolve({ incoming, existing }), "accept");
  });

  test("accepts an equal timestamp", () => {
    const resolver = new LastWriteWinsResolver();
    const existing = header({ clientId: "A", timestamp: 1000 });
    const incoming = header({ clientId: "A", timestamp: 1000 });

    assert.strictEqual(resolver.resolve({ incoming, existing }), "accept");
  });

  test("a different client with an older timestamp is still rejected (short-circuit is same-client only)", () => {
    const resolver = new LastWriteWinsResolver();
    const existing = header({ clientId: "A", timestamp: 2000 });
    const incoming = header({ clientId: "B", timestamp: 500 });

    assert.strictEqual(resolver.resolve({ incoming, existing }), "reject");
  });
});
