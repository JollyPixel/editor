// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { sortSelfFirst } from "../../src/peer/peerOrder.ts";
import type { CollaboratorPresence } from "../../src/peer/types.ts";

function peer(
  clientId: string
): CollaboratorPresence {
  return {
    clientId,
    displayName: clientId,
    color: "oklch(60% 0.16 0)"
  };
}

function clientIds(
  peers: readonly CollaboratorPresence[]
): string[] {
  return peers.map((entry) => entry.clientId);
}

describe("sortSelfFirst", () => {
  test("puts the local peer first, then sorts by clientId", () => {
    const sorted = sortSelfFirst(
      [peer("zoe"), peer("ada"), peer("me"), peer("lin")],
      "me"
    );

    assert.deepEqual(clientIds(sorted), ["me", "ada", "lin", "zoe"]);
  });

  test("orders identically whatever order each client saw peers join in", () => {
    const forward = sortSelfFirst([peer("ada"), peer("lin"), peer("zoe")], "me");
    const reversed = sortSelfFirst([peer("zoe"), peer("lin"), peer("ada")], "me");

    assert.deepEqual(clientIds(forward), clientIds(reversed));
  });

  test("compares clientIds by code unit, so every locale agrees", () => {
    const sorted = sortSelfFirst([peer("b"), peer("a"), peer("B")], "me");

    assert.deepEqual(clientIds(sorted), ["B", "a", "b"]);
  });
});
