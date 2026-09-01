// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Internal Dependencies
import {
  peerColor,
  readPeerId,
  readUsername,
  toPeerMetadata
} from "../../src/network/identity.ts";

describe("readUsername", () => {
  test("reads a stamped username", () => {
    assert.strictEqual(readUsername({ username: "Ada" }), "Ada");
  });

  test("falls back for a missing or non-string username", () => {
    assert.strictEqual(readUsername({}), "Guest");
    assert.strictEqual(readUsername(undefined), "Guest");
    assert.strictEqual(readUsername({ username: 42 }), "Guest");
  });
});

describe("readPeerId", () => {
  test("reads a stamped peerId", () => {
    assert.strictEqual(readPeerId({ peerId: "abc" }), "abc");
  });

  test("returns undefined for a missing or non-string peerId", () => {
    assert.strictEqual(readPeerId({}), undefined);
    assert.strictEqual(readPeerId(undefined), undefined);
    assert.strictEqual(readPeerId({ peerId: null }), undefined);
  });
});

describe("peerColor", () => {
  test("is stable for one peerId, whatever the connection id", () => {
    assert.strictEqual(
      peerColor("client-1", { peerId: "abc" }),
      peerColor("client-2", { peerId: "abc" })
    );
  });

  test("falls back to the connection id without a stamped peerId", () => {
    assert.strictEqual(
      peerColor("client-1", {}),
      peerColor("client-1", { peerId: undefined })
    );
  });

  test("returns a CSS color", () => {
    assert.match(peerColor("client-1", { peerId: "abc" }), /^#[0-9a-f]{6}$/i);
  });
});

describe("toPeerMetadata", () => {
  test("carries the username and peerId, never the derived color", () => {
    assert.deepStrictEqual(
      toPeerMetadata({
        username: "Ada",
        peerId: "abc",
        color: "#ff0000"
      }),
      {
        username: "Ada",
        peerId: "abc"
      }
    );
  });
});
