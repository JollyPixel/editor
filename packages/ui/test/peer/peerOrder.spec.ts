// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  compareClientIds,
  partitionPeers
} from "../../src/peer/peerOrder.ts";
import type { PresencePeer } from "../../src/peer/PresencePeer.ts";

function peer(
  clientId: string
): PresencePeer {
  return {
    clientId,
    displayName: clientId,
    color: "oklch(60% 0.16 0)"
  };
}

function clientIds(
  peers: readonly PresencePeer[]
): string[] {
  return peers.map((entry) => entry.clientId);
}

describe("compareClientIds", () => {
  test("compares by code unit, so every locale agrees", () => {
    assert.deepEqual(["b", "a", "B"].sort(compareClientIds), ["B", "a", "b"]);
  });
});

describe("partitionPeers", () => {
  function snapshot(
    selfId: string
  ): PresencePeer[] {
    return ["ada", "lin", "zoe", "sam"].map((clientId) => {
      return {
        ...peer(clientId),
        self: clientId === selfId
      };
    });
  }

  function partitionIds(
    peers: readonly PresencePeer[],
    max: number
  ): Record<"visible" | "hidden", string[]> {
    const { visible, hidden } = partitionPeers(peers, max);

    return {
      visible: clientIds(visible),
      hidden: clientIds(hidden)
    };
  }

  test("shows the first peers up to max and hides the rest in order", () => {
    assert.deepEqual(partitionIds(snapshot("ada"), 2), {
      visible: ["ada", "lin"],
      hidden: ["zoe", "sam"]
    });
  });

  test("swaps the last visible peer for a local peer past max", () => {
    assert.deepEqual(partitionIds(snapshot("sam"), 2), {
      visible: ["ada", "sam"],
      hidden: ["lin", "zoe"]
    });
  });

  test("hides every peer, the local one included, at max 0", () => {
    assert.deepEqual(partitionIds(snapshot("sam"), 0), {
      visible: [],
      hidden: ["ada", "lin", "zoe", "sam"]
    });
  });
});
