// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  PeerHoverRegistry,
  PeerSelectionRegistry,
  type PeerSelectionChangeEventDetail
} from "#src/index.ts";
import { createStubColorAllocator } from "./helpers.ts";

describe("select", () => {
  test("records a peer's selection", () => {
    const registry = new PeerSelectionRegistry();
    registry.select("peer-a", "box");

    assert.strictEqual(registry.selectedObject("peer-a"), "box");
    assert.deepStrictEqual(registry.listSelectors("box"), ["peer-a"]);
  });

  test("a second peer selecting the same object is appended after the first", () => {
    const registry = new PeerSelectionRegistry();
    registry.select("peer-a", "box");
    registry.select("peer-b", "box");

    assert.deepStrictEqual(registry.listSelectors("box"), ["peer-a", "peer-b"]);
    assert.strictEqual(registry.primarySelector("box"), "peer-a");
  });

  test("moving a peer from one object to another removes it from the first", () => {
    const registry = new PeerSelectionRegistry();
    registry.select("peer-a", "box");
    registry.select("peer-a", "cone");

    assert.deepStrictEqual(registry.listSelectors("box"), []);
    assert.deepStrictEqual(registry.listSelectors("cone"), ["peer-a"]);
    assert.strictEqual(registry.selectedObject("peer-a"), "cone");
  });

  test("deselecting the primary peer promotes the next-oldest remaining peer", () => {
    const registry = new PeerSelectionRegistry();
    registry.select("peer-a", "box");
    registry.select("peer-b", "box");
    registry.select("peer-a", null);

    assert.strictEqual(registry.primarySelector("box"), "peer-b");
    assert.deepStrictEqual(registry.listSelectors("box"), ["peer-b"]);
  });

  test("is a no-op (and does not dispatch) when re-selecting the same object", () => {
    const registry = new PeerSelectionRegistry();
    registry.select("peer-a", "box");

    let dispatched = false;
    registry.addEventListener("peerSelectionChange", () => {
      dispatched = true;
    });
    registry.select("peer-a", "box");

    assert.strictEqual(dispatched, false);
  });

  test("dispatches peerSelectionChange with the correct detail", () => {
    const registry = new PeerSelectionRegistry();
    registry.select("peer-a", "box");

    let detail: PeerSelectionChangeEventDetail | undefined;
    registry.addEventListener("peerSelectionChange", (event) => {
      detail = (event as CustomEvent<PeerSelectionChangeEventDetail>).detail;
    });
    registry.select("peer-a", "cone");

    assert.deepStrictEqual(detail, { peerId: "peer-a", objectId: "cone", previousObjectId: "box" });
  });
});

describe("selectedObjectIds", () => {
  test("returns every object id with at least one current selector", () => {
    const registry = new PeerSelectionRegistry();
    registry.select("peer-a", "box");
    registry.select("peer-b", "cone");

    assert.deepStrictEqual(new Set(registry.selectedObjectIds()), new Set(["box", "cone"]));
  });

  test("a second peer on an already-selected object does not duplicate its id", () => {
    const registry = new PeerSelectionRegistry();
    registry.select("peer-a", "box");
    registry.select("peer-b", "box");

    assert.deepStrictEqual(registry.selectedObjectIds(), ["box"]);
  });

  test("drops an id once its last selector deselects", () => {
    const registry = new PeerSelectionRegistry();
    registry.select("peer-a", "box");
    registry.select("peer-a", null);

    assert.deepStrictEqual(registry.selectedObjectIds(), []);
  });
});

describe("removePeer", () => {
  test("clears the peer's selection", () => {
    const registry = new PeerSelectionRegistry();
    registry.select("peer-a", "box");
    registry.removePeer("peer-a");

    assert.strictEqual(registry.selectedObject("peer-a"), null);
    assert.deepStrictEqual(registry.listSelectors("box"), []);
  });
});

describe("peerColor", () => {
  test("resolves a peer to the same color on another registry, whatever was asked first", () => {
    const registry = new PeerSelectionRegistry();
    registry.peerColor("peer-b");

    assert.strictEqual(registry.peerColor("peer-a"), new PeerHoverRegistry().peerColor("peer-a"));
  });
});

describe("colorAllocator", () => {
  test("delegates peerColor to the injected allocator", () => {
    const allocator = createStubColorAllocator();
    const registry = new PeerSelectionRegistry({ colorAllocator: allocator });

    assert.strictEqual(registry.peerColor("peer-a"), "stub:peer-a");
  });

  test("calls release on removePeer", () => {
    const allocator = createStubColorAllocator();
    const registry = new PeerSelectionRegistry({ colorAllocator: allocator });
    registry.select("peer-a", "box");

    registry.removePeer("peer-a");

    assert.deepStrictEqual(allocator.released, ["peer-a"]);
  });

  test("does not call release on dispose", () => {
    const allocator = createStubColorAllocator();
    const registry = new PeerSelectionRegistry({ colorAllocator: allocator });
    registry.select("peer-a", "box");

    registry.dispose();

    assert.deepStrictEqual(allocator.released, []);
  });
});

describe("dispose", () => {
  test("clears all peer and object state", () => {
    const registry = new PeerSelectionRegistry();
    registry.select("peer-a", "box");
    registry.dispose();

    assert.strictEqual(registry.selectedObject("peer-a"), null);
    assert.deepStrictEqual(registry.listSelectors("box"), []);
    assert.strictEqual(registry.primarySelector("box"), null);
  });
});
