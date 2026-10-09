// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Third-party Dependencies
import {
  BlockTransform,
  type BlockTransformJSON
} from "@jolly-pixel/asset.voxel-model/client";

// Import Internal Dependencies
import { TransformLiveSync } from "#src/features/transform/collaboration/TransformLiveSync.ts";
import type { ModelBlock } from "#src/scene/blocks/index.ts";
import { createRoomHarness } from "../../../collaboration/roomHarness.ts";
import { createModelFixture } from "../../../fixtures/model.ts";

// CONSTANTS
const kWave = "wave";
const kRun = "run";
const kShown: BlockTransformJSON = {
  position: { x: 0, y: 0, z: 0 },
  pivotOffset: { x: 0, y: 0, z: 0 },
  size: { x: 1, y: 1, z: 1 },
  scale: { x: 1, y: 1, z: 1 },
  rotation: { x: 0, y: 0, z: 0 }
};

function createView() {
  const listeners = new Set<() => void>();
  const view = {
    shown: null as string | null,
    key: () => view.shown,
    shownTransform: () => kShown,
    subscribe: (listener: () => void) => {
      listeners.add(listener);

      return () => listeners.delete(listener);
    },
    show: (key: string | null) => {
      view.shown = key;
      for (const listener of listeners) {
        listener();
      }
    }
  };

  return view;
}

function createHarness(
  view = createView()
) {
  const room = createRoomHarness();
  room.addPeer("bob");
  const { blocks, addBlock } = createModelFixture();
  const frames = { requested: 0 };
  const sync = new TransformLiveSync({
    room: room.room,
    blocks,
    view,
    requestFrame: () => frames.requested++
  });

  return {
    ...room,
    blocks,
    addBlock,
    sync,
    view,
    frames
  };
}

function publishLive(
  harness: ReturnType<typeof createHarness>,
  uuid: string,
  x: number,
  view: string | null = null
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
        },
        view
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

function liveX(
  frame: unknown
): number | null {
  if (typeof frame !== "object" || frame === null) {
    return null;
  }

  return BlockTransform.parse(Reflect.get(frame, "transform"))?.position.x ?? null;
}

function isGlowing(
  block: ModelBlock
): boolean {
  const marker = block.node.children.find((child) => child.name === "pivot_visual");

  return marker?.visible ?? false;
}

describe("TransformLiveSync", () => {
  test("requests a frame for each live transform and once the stream expires", (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const harness = createHarness();
    const block = harness.addBlock();

    publishLive(harness, block.uuid, 5);
    publishLive(harness, block.uuid, 6);
    assert.equal(harness.frames.requested, 2);

    t.mock.timers.tick(5000);
    assert.equal(harness.frames.requested, 3);
    harness.sync.dispose();
  });

  test("moves the real block to the live position", () => {
    const harness = createHarness();
    const block = harness.addBlock();

    publishLive(harness, block.uuid, 5);

    assert.equal(block.position.x, 5);
    harness.sync.dispose();
  });

  test("ignores a live payload whose transform is malformed", () => {
    const harness = createHarness();
    const block = harness.addBlock();

    harness.emit("peer-presence", {
      clientId: "bob",
      patch: {
        transformLive: {
          uuid: block.uuid,
          transform: { position: { x: 5, y: 0, z: "0" } }
        }
      }
    });

    assert.equal(block.position.x, 0);
    assert.ok(!isGlowing(block));
    harness.sync.dispose();
  });

  test("does not revert an explicit clear, since the authoritative commit is imminent", () => {
    const harness = createHarness();
    const block = harness.addBlock();

    publishLive(harness, block.uuid, 5);
    clearLive(harness);

    assert.equal(block.position.x, 5);
    harness.sync.dispose();
  });

  test("reverts once the stream goes silent", (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const harness = createHarness();
    const block = harness.addBlock();

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
    const block = harness.addBlock();

    publishLive(harness, block.uuid, 5);
    t.mock.timers.tick(3000);
    publishLive(harness, block.uuid, 6);
    t.mock.timers.tick(3000);

    assert.equal(block.position.x, 6);
    assert.ok(isGlowing(block));
    harness.sync.dispose();
  });

  test("reverts when the peer disconnects mid-drag", () => {
    const harness = createHarness();
    const block = harness.addBlock();

    publishLive(harness, block.uuid, 5);
    harness.removePeer("bob");
    harness.emit("peer-left", { clientId: "bob" });

    assert.equal(block.position.x, 0);
    harness.sync.dispose();
  });

  test("shows a peer-colored outline while the stream is live, removed once it ends", () => {
    const harness = createHarness();
    const block = harness.addBlock();

    publishLive(harness, block.uuid, 5);
    assert.ok(isGlowing(block));

    clearLive(harness);
    assert.ok(!isGlowing(block));
    harness.sync.dispose();
  });

  test("does not clear a peer's selection glow once their drag stream ends", () => {
    const harness = createHarness();
    const block = harness.addBlock();

    block.emphasize("#112233", "selection:bob");
    publishLive(harness, block.uuid, 5);
    clearLive(harness);

    assert.ok(isGlowing(block), "bob's selection glow must survive the end of their drag stream");
    block.clearEmphasis("selection:bob");
    harness.sync.dispose();
  });

  test("leaves the block at its last live position on dispose", () => {
    const harness = createHarness();
    const block = harness.addBlock();

    publishLive(harness, block.uuid, 5);
    harness.sync.dispose();

    assert.equal(block.position.x, 5);
  });

  test("publishes a throttled live transform that ends on the latest one, and null on clear", (t) => {
    t.mock.timers.enable({ apis: ["Date", "setTimeout"], now: 1000 });
    const harness = createHarness();
    const block = harness.addBlock();
    function at(
      x: number
    ) {
      return {
        ...block.transform,
        position: { x, y: 0, z: 0 }
      };
    }

    harness.sync.publish(block.uuid, at(1));
    harness.sync.publish(block.uuid, at(2));
    harness.sync.publish(block.uuid, at(3));
    t.mock.timers.tick(50);
    harness.sync.publish(block.uuid, at(4));
    harness.sync.clear();
    t.mock.timers.tick(50);

    assert.deepEqual(
      harness.published.map((patch) => liveX(patch.transformLive)),
      [1, 3, null]
    );
    harness.sync.dispose();
  });

  test("publishes the shown view with the transform", () => {
    const harness = createHarness();
    const block = harness.addBlock();

    harness.view.show(kWave);
    harness.sync.publish(block.uuid, block.transform);

    assert.deepEqual(harness.published, [{
      transformLive: { uuid: block.uuid, transform: block.transform, view: kWave }
    }]);
    harness.sync.dispose();
  });
});

describe("TransformLiveSync clip gating", () => {
  test("shows a peer keying the clip I pose, and ignores one keying another clip", () => {
    const view = createView();
    view.show(kWave);
    const harness = createHarness(view);
    const block = harness.addBlock();

    publishLive(harness, block.uuid, 5, kRun);
    assert.equal(block.position.x, 0);

    publishLive(harness, block.uuid, 6, kWave);
    assert.equal(block.position.x, 6);
    harness.sync.dispose();
  });

  test("ignores a drag whose view is not an animation key", () => {
    const view = createView();
    view.show(kWave);
    const harness = createHarness(view);
    const block = harness.addBlock();

    publishLive(harness, block.uuid, 5, "walk:wave");
    assert.equal(block.position.x, 0);
    harness.sync.dispose();
  });

  test("ignores rest pose drags while I pose a clip, and clip drags while I show the rest pose", () => {
    const view = createView();
    const harness = createHarness(view);
    const block = harness.addBlock();

    publishLive(harness, block.uuid, 5, kWave);
    assert.equal(block.position.x, 0);

    view.show(kWave);
    publishLive(harness, block.uuid, 6);
    assert.equal(block.position.x, 0);
    harness.sync.dispose();
  });

  test("hands a stream back to my own pose when I leave its clip", () => {
    const view = createView();
    view.show(kWave);
    const harness = createHarness(view);
    const block = harness.addBlock();

    publishLive(harness, block.uuid, 5, kWave);
    view.show(kRun);

    assert.equal(block.position.x, 0);
    assert.ok(!isGlowing(block));
    harness.sync.dispose();
  });

  test("re-poses a block once a clip drag is cleared, since its key may land on another tick", () => {
    const view = createView();
    view.show(kWave);
    const harness = createHarness(view);
    const block = harness.addBlock();

    publishLive(harness, block.uuid, 5, kWave);
    clearLive(harness);

    assert.equal(block.position.x, 0);
    harness.sync.dispose();
  });
});
