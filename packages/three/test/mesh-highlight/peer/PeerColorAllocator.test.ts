// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  createListedColorAllocator,
  type ListedPeerColor
} from "#src/index.ts";

describe("createListedColorAllocator", () => {
  test("reads the listed color of a peer on every lookup, white when unlisted", () => {
    let peers: ListedPeerColor[] = [
      {
        clientId: "alice",
        color: "#ff0000"
      }
    ];
    const allocator = createListedColorAllocator(() => peers);

    assert.equal(allocator.peerColor("alice"), "#ff0000");
    assert.equal(allocator.peerColor("bob"), "#ffffff");

    peers = [
      {
        clientId: "alice",
        color: "#00ff00"
      }
    ];
    assert.equal(allocator.peerColor("alice"), "#00ff00");
  });
});
