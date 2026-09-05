// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  PeerHoverRegistry,
  type PeerHoverChangeEventDetail,
  type PeerColorAllocator
} from "#src/index.ts";

function createStubColorAllocator(): PeerColorAllocator & { released: string[]; } {
  const released: string[] = [];

  return {
    released,
    colorOf: (peerId) => `stub:${peerId}`,
    release: (peerId) => {
      released.push(peerId);
    }
  };
}

describe("hover", () => {
  test("records a peer's hover", () => {
    const registry = new PeerHoverRegistry();
    registry.hover("peer-a", "box");

    assert.strictEqual(registry.hoverOf("peer-a"), "box");
    assert.deepStrictEqual(registry.hoverersOf("box"), ["peer-a"]);
  });

  test("a second peer hovering the same object is appended after the first", () => {
    const registry = new PeerHoverRegistry();
    registry.hover("peer-a", "box");
    registry.hover("peer-b", "box");

    assert.deepStrictEqual(registry.hoverersOf("box"), ["peer-a", "peer-b"]);
    assert.strictEqual(registry.primaryHovererOf("box"), "peer-a");
  });

  test("moving a peer from one object to another removes it from the first", () => {
    const registry = new PeerHoverRegistry();
    registry.hover("peer-a", "box");
    registry.hover("peer-a", "cone");

    assert.deepStrictEqual(registry.hoverersOf("box"), []);
    assert.deepStrictEqual(registry.hoverersOf("cone"), ["peer-a"]);
    assert.strictEqual(registry.hoverOf("peer-a"), "cone");
  });

  test("un-hovering the primary peer promotes the next-oldest remaining peer", () => {
    const registry = new PeerHoverRegistry();
    registry.hover("peer-a", "box");
    registry.hover("peer-b", "box");
    registry.hover("peer-a", null);

    assert.strictEqual(registry.primaryHovererOf("box"), "peer-b");
    assert.deepStrictEqual(registry.hoverersOf("box"), ["peer-b"]);
  });

  test("is a no-op (and does not dispatch) when re-hovering the same object", () => {
    const registry = new PeerHoverRegistry();
    registry.hover("peer-a", "box");

    let dispatched = false;
    registry.addEventListener("peerHoverChange", () => {
      dispatched = true;
    });
    registry.hover("peer-a", "box");

    assert.strictEqual(dispatched, false);
  });

  test("dispatches peerHoverChange with the correct detail", () => {
    const registry = new PeerHoverRegistry();
    registry.hover("peer-a", "box");

    let detail: PeerHoverChangeEventDetail | undefined;
    registry.addEventListener("peerHoverChange", (event) => {
      detail = (event as CustomEvent<PeerHoverChangeEventDetail>).detail;
    });
    registry.hover("peer-a", "cone");

    assert.deepStrictEqual(detail, { peerId: "peer-a", objectId: "cone", previousObjectId: "box" });
  });
});

describe("hoveredObjectIds", () => {
  test("returns every object id with at least one current hoverer", () => {
    const registry = new PeerHoverRegistry();
    registry.hover("peer-a", "box");
    registry.hover("peer-b", "cone");

    assert.deepStrictEqual(new Set(registry.hoveredObjectIds()), new Set(["box", "cone"]));
  });

  test("a second peer on an already-hovered object does not duplicate its id", () => {
    const registry = new PeerHoverRegistry();
    registry.hover("peer-a", "box");
    registry.hover("peer-b", "box");

    assert.deepStrictEqual(registry.hoveredObjectIds(), ["box"]);
  });

  test("drops an id once its last hoverer stops hovering", () => {
    const registry = new PeerHoverRegistry();
    registry.hover("peer-a", "box");
    registry.hover("peer-a", null);

    assert.deepStrictEqual(registry.hoveredObjectIds(), []);
  });
});

describe("removePeer", () => {
  test("clears the peer's hover", () => {
    const registry = new PeerHoverRegistry();
    registry.hover("peer-a", "box");
    registry.removePeer("peer-a");

    assert.strictEqual(registry.hoverOf("peer-a"), null);
    assert.deepStrictEqual(registry.hoverersOf("box"), []);
  });
});

describe("colorOf", () => {
  test("returns the same color for the same peer id", () => {
    const registry = new PeerHoverRegistry();

    assert.strictEqual(registry.colorOf("peer-a"), registry.colorOf("peer-a"));
  });
});

describe("colorAllocator", () => {
  test("delegates colorOf to the injected allocator", () => {
    const allocator = createStubColorAllocator();
    const registry = new PeerHoverRegistry({ colorAllocator: allocator });

    assert.strictEqual(registry.colorOf("peer-a"), "stub:peer-a");
  });

  test("calls release on removePeer", () => {
    const allocator = createStubColorAllocator();
    const registry = new PeerHoverRegistry({ colorAllocator: allocator });
    registry.hover("peer-a", "box");

    registry.removePeer("peer-a");

    assert.deepStrictEqual(allocator.released, ["peer-a"]);
  });

  test("does not call release on dispose", () => {
    const allocator = createStubColorAllocator();
    const registry = new PeerHoverRegistry({ colorAllocator: allocator });
    registry.hover("peer-a", "box");

    registry.dispose();

    assert.deepStrictEqual(allocator.released, []);
  });
});

describe("dispose", () => {
  test("clears all peer and object state", () => {
    const registry = new PeerHoverRegistry();
    registry.hover("peer-a", "box");
    registry.dispose();

    assert.strictEqual(registry.hoverOf("peer-a"), null);
    assert.deepStrictEqual(registry.hoverersOf("box"), []);
    assert.strictEqual(registry.primaryHovererOf("box"), null);
  });
});
