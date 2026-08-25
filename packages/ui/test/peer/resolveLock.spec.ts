// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  resolveLock,
  sortSelfFirst
} from "../../src/peer/resolveLock.ts";
import type { CollaboratorPresence } from "../../src/peer/types.ts";

function peer(
  clientId: string,
  editing?: string
): CollaboratorPresence {
  return {
    clientId,
    displayName: clientId,
    color: "oklch(60% 0.16 0)",
    ...(editing === undefined ? {} : { editing })
  };
}

describe("resolveLock", () => {
  test("a null path never locks", () => {
    const lock = resolveLock([peer("me", "map.width")], null, "me");

    assert.deepEqual(lock, { lockedBy: null, peers: [] });
  });

  test("a path nobody edits is unlocked", () => {
    const lock = resolveLock([peer("ada", "map.height")], "map.width", "me");

    assert.deepEqual(lock, { lockedBy: null, peers: [] });
  });

  test("a remote peer holds the path", () => {
    const lock = resolveLock([peer("ada", "map.width")], "map.width", "me");

    assert.equal(lock.lockedBy?.clientId, "ada");
    assert.deepEqual(lock.peers.map((entry) => entry.clientId), ["ada"]);
  });

  test("the local peer never locks its own field", () => {
    const lock = resolveLock([peer("me", "map.width")], "map.width", "me");

    assert.equal(lock.lockedBy, null);
    assert.deepEqual(lock.peers.map((entry) => entry.clientId), ["me"]);
  });

  test("local focus wins a contended path, which shows as a chip", () => {
    const lock = resolveLock(
      [peer("ada", "map.width"), peer("me", "map.width")],
      "map.width",
      "me"
    );

    assert.equal(lock.lockedBy, null);
    assert.deepEqual(lock.peers.map((entry) => entry.clientId), ["me", "ada"]);
  });
});

describe("sortSelfFirst", () => {
  test("puts the local peer first, then sorts by clientId", () => {
    const sorted = sortSelfFirst(
      [peer("zoe"), peer("ada"), peer("me"), peer("lin")],
      "me"
    );

    assert.deepEqual(
      sorted.map((entry) => entry.clientId),
      ["me", "ada", "lin", "zoe"]
    );
  });

  test("orders identically whatever order each client saw peers join in", () => {
    const forward = sortSelfFirst([peer("ada"), peer("lin"), peer("zoe")], "me");
    const reversed = sortSelfFirst([peer("zoe"), peer("lin"), peer("ada")], "me");

    assert.deepEqual(
      forward.map((entry) => entry.clientId),
      reversed.map((entry) => entry.clientId)
    );
  });
});
