// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { PeerSelectionHighlight } from "#src/collaboration/PeerSelectionHighlight.ts";
import { TransformLiveSync } from "#src/collaboration/TransformLiveSync.ts";
import {
  ModelBlocks,
  type ModelBlock
} from "#src/model/index.ts";
import { PresenceStore } from "#src/state/index.ts";
import { createRoomHarness } from "./roomHarness.ts";

function createHarness() {
  const room = createRoomHarness();
  room.addPeer("bob");
  const blocks = new ModelBlocks(new THREE.Scene());
  const sync = new TransformLiveSync({
    room: room.room,
    blocks
  });

  return { ...room, blocks, sync };
}

function publishLive(
  harness: ReturnType<typeof createHarness>,
  uuid: string,
  x: number
): void {
  harness.emit("peer-presence", {
    clientId: "bob",
    patch: {
      transformLive: {
        uuid,
        transform: {
          position: { x, y: 0, z: 0 },
          pivotOffset: { x: 0, y: 0, z: 0 },
          size: { x: 1, y: 1, z: 1 },
          scale: { x: 1, y: 1, z: 1 },
          rotation: { x: 0, y: 0, z: 0 }
        }
      }
    }
  });
}

function clearLive(
  harness: ReturnType<typeof createHarness>
): void {
  harness.emit("peer-presence", {
    clientId: "bob",
    patch: { transformLive: null }
  });
}

function isGlowing(
  block: ModelBlock
): boolean {
  return block.mesh.children.some((child) => child.name === "emphasis-shell");
}

describe("TransformLiveSync", () => {
  test("moves the real block to the live position", () => {
    const harness = createHarness();
    const block = harness.blocks.add();

    publishLive(harness, block.uuid, 5);

    assert.equal(block.position.x, 5);
    harness.sync.dispose();
  });

  test("does not revert an explicit clear, since the authoritative commit is imminent", () => {
    const harness = createHarness();
    const block = harness.blocks.add();

    publishLive(harness, block.uuid, 5);
    clearLive(harness);

    assert.equal(block.position.x, 5);
    harness.sync.dispose();
  });

  test("reverts to the pre-drag baseline once the stream goes silent", (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const harness = createHarness();
    const block = harness.blocks.add();

    publishLive(harness, block.uuid, 5);
    t.mock.timers.tick(4999);
    assert.equal(block.position.x, 5);

    t.mock.timers.tick(1);
    assert.equal(block.position.x, 0);
    harness.sync.dispose();
  });

  test("keeps a drag that outlasts the expiry, as long as updates keep arriving", (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const harness = createHarness();
    const block = harness.blocks.add();

    publishLive(harness, block.uuid, 5);
    t.mock.timers.tick(3000);
    publishLive(harness, block.uuid, 6);
    t.mock.timers.tick(3000);

    assert.equal(block.position.x, 6);
    assert.ok(isGlowing(block));
    harness.sync.dispose();
  });

  test("reverts to the pre-drag baseline when the peer disconnects mid-drag", () => {
    const harness = createHarness();
    const block = harness.blocks.add();

    publishLive(harness, block.uuid, 5);
    harness.removePeer("bob");
    harness.emit("peer-left", { clientId: "bob" });

    assert.equal(block.position.x, 0);
    harness.sync.dispose();
  });

  test("shows a peer-colored outline while the stream is live, removed once it ends", () => {
    const harness = createHarness();
    const block = harness.blocks.add();

    publishLive(harness, block.uuid, 5);
    assert.ok(isGlowing(block));

    clearLive(harness);
    assert.ok(!isGlowing(block));
    harness.sync.dispose();
  });

  test("does not clear a peer's selection glow once their drag stream ends", () => {
    const harness = createHarness();
    const block = harness.blocks.add();
    const presence = new PresenceStore();
    const highlight = new PeerSelectionHighlight({
      blocks: harness.blocks,
      presence
    });

    presence.blockSelections = new Map([
      [block.uuid, [{ clientId: "bob", displayName: "bob", color: "#112233" }]]
    ]);
    publishLive(harness, block.uuid, 5);
    clearLive(harness);

    assert.ok(isGlowing(block), "bob's selection glow must survive the end of their drag stream");
    highlight.dispose();
    harness.sync.dispose();
  });

  test("leaves the block at its last live position on dispose", () => {
    const harness = createHarness();
    const block = harness.blocks.add();

    publishLive(harness, block.uuid, 5);
    harness.sync.dispose();

    assert.equal(block.position.x, 5);
  });

  test("publishes a throttled live transform, and null on clear", (t) => {
    t.mock.timers.enable({ apis: ["Date"], now: 1000 });
    const harness = createHarness();
    const block = harness.blocks.add();

    harness.sync.publish(block.uuid, block.transform);
    harness.sync.publish(block.uuid, block.transform);
    harness.sync.clear();

    assert.deepEqual(
      harness.published.map((patch) => patch.transformLive && "uuid"),
      ["uuid", null]
    );
    harness.sync.dispose();
  });
});
