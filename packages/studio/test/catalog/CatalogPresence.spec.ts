// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { OPEN_ASSETS_KEY } from "@jolly-pixel/server";

// Import Internal Dependencies
import type { AssetOccupancy } from "../../src/catalog/AssetOccupancy.ts";
import { CatalogPresence } from "../../src/catalog/CatalogPresence.ts";
import { chatRoomHarness } from "../helpers/chatRoom.ts";

function occupants(
  occupancy: AssetOccupancy,
  assetId: string
): string[] {
  return occupancy.occupants(assetId).map(
    ({ peer, focused }) => `${peer.displayName}${focused ? " (editing)" : ""}`
  );
}

describe("CatalogPresence", () => {
  test("lists each peer on the assets it has open, the focused ones first", () => {
    const harness = chatRoomHarness();
    using presence = new CatalogPresence(harness.room);

    harness.addPeer("bob", { username: "Bob" }, {
      [OPEN_ASSETS_KEY]: { open: ["map-1"], focused: null }
    });
    harness.addPeer("alice", { username: "Alice" }, {
      [OPEN_ASSETS_KEY]: { open: ["map-1", "model-1"], focused: "map-1" }
    });
    harness.addPeer("builder", { username: "Builder" }, {
      [OPEN_ASSETS_KEY]: { open: [], focused: "scene-1" }
    });
    harness.addPeer("old", { username: "Old" }, {
      [OPEN_ASSETS_KEY]: ["map-1"]
    });

    assert.deepEqual(occupants(presence.occupancy, "map-1"), ["Alice (editing)", "Bob"]);
    assert.deepEqual(occupants(presence.occupancy, "model-1"), ["Alice"]);
    assert.deepEqual(occupants(presence.occupancy, "scene-1"), ["Builder (editing)"]);
  });

  test("leaves out the other connections of the local person", () => {
    const harness = chatRoomHarness("write", { username: "Ada", peerId: "ada" });
    using presence = new CatalogPresence(harness.room);

    harness.addPeer("other-tab", { username: "Ada", peerId: "ada" }, {
      [OPEN_ASSETS_KEY]: { open: ["map-1"], focused: "map-1" }
    });
    harness.addPeer("bob", { username: "Bob", peerId: "bob" }, {
      [OPEN_ASSETS_KEY]: { open: ["map-1"], focused: null }
    });

    assert.deepEqual(occupants(presence.occupancy, "map-1"), ["Bob"]);
  });

  test("follows a peer that changes tabs or leaves", () => {
    const harness = chatRoomHarness();
    using presence = new CatalogPresence(harness.room);
    harness.addPeer("alice", { username: "Alice" }, {
      [OPEN_ASSETS_KEY]: { open: ["map-1"], focused: "map-1" }
    });

    harness.patchPresence("alice", {
      [OPEN_ASSETS_KEY]: { open: ["map-1", "model-1"], focused: "model-1" }
    });
    const switched = presence.occupancy;
    harness.removePeer("alice");

    assert.deepEqual(occupants(switched, "map-1"), ["Alice"]);
    assert.deepEqual(occupants(switched, "model-1"), ["Alice (editing)"]);
    assert.ok(presence.occupancy.isEmpty);
  });

  test("publishes the open tabs, focused only while an asset tab is active", () => {
    const harness = chatRoomHarness();
    using presence = new CatalogPresence(harness.room);

    presence.showTabs(["map-1"], "map-1");
    presence.showTabs(["map-1", "model-1"], "studio:home");
    presence.showTabs(["map-1", "model-1"], "studio:settings");

    assert.deepEqual(harness.published, [
      { [OPEN_ASSETS_KEY]: { open: ["map-1"], focused: "map-1" } },
      { [OPEN_ASSETS_KEY]: { open: ["map-1", "model-1"], focused: null } }
    ]);
  });
});
