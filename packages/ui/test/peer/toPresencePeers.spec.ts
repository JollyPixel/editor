// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { toPresencePeers } from "../../src/peer/toPresencePeers.ts";
import type { CollaboratorPresence } from "../../src/peer/types.ts";

function peer(
  clientId: string
): CollaboratorPresence {
  return {
    clientId,
    displayName: clientId.toUpperCase(),
    color: "oklch(60% 0.16 0)"
  };
}

describe("toPresencePeers", () => {
  test("flags the local peer and orders it first", () => {
    const peers = toPresencePeers([peer("zoe"), peer("me"), peer("ada")], "me");

    assert.deepEqual(peers.map((entry) => entry.clientId), ["me", "ada", "zoe"]);
    assert.deepEqual(peers.map((entry) => entry.self ?? false), [true, false, false]);
  });

  test("carries the display fields through unchanged", () => {
    const [entry] = toPresencePeers([peer("ada")], "me");

    assert.equal(entry.displayName, "ADA");
    assert.equal(entry.color, "oklch(60% 0.16 0)");
  });

  test("flags nobody when the local peer is absent", () => {
    const peers = toPresencePeers([peer("ada")], "me");

    assert.deepEqual(peers.map((entry) => entry.self), [false]);
  });
});
