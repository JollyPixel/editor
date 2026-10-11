// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Internal Dependencies
import {
  WAVE,
  clearLive,
  createLiveSyncHarness,
  isGlowing,
  liveX,
  publishLive
} from "./liveSyncHarness.ts";

describe("TransformLiveSync", () => {
  test("requests a frame for each live transform and once the stream expires", (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const harness = createLiveSyncHarness();
    const block = harness.addBlock();

    publishLive(harness, block.uuid, 5);
    publishLive(harness, block.uuid, 6);
    assert.equal(harness.frames.requested, 2);

    t.mock.timers.tick(5000);
    assert.equal(harness.frames.requested, 3);
    harness.sync.dispose();
  });

  test("moves the real block to the live position", () => {
    const harness = createLiveSyncHarness();
    const block = harness.addBlock();

    publishLive(harness, block.uuid, 5);

    assert.equal(block.position.x, 5);
    harness.sync.dispose();
  });

  test("ignores a live payload whose transform is malformed", () => {
    const harness = createLiveSyncHarness();
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
    const harness = createLiveSyncHarness();
    const block = harness.addBlock();

    publishLive(harness, block.uuid, 5);
    clearLive(harness);

    assert.equal(block.position.x, 5);
    harness.sync.dispose();
  });

  test("reverts once the stream goes silent", (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const harness = createLiveSyncHarness();
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
    const harness = createLiveSyncHarness();
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
    const harness = createLiveSyncHarness();
    const block = harness.addBlock();

    publishLive(harness, block.uuid, 5);
    harness.removePeer("bob");
    harness.emit("peer-left", { clientId: "bob" });

    assert.equal(block.position.x, 0);
    harness.sync.dispose();
  });

  test("shows a peer-colored outline while the stream is live, removed once it ends", () => {
    const harness = createLiveSyncHarness();
    const block = harness.addBlock();

    publishLive(harness, block.uuid, 5);
    assert.ok(isGlowing(block));

    clearLive(harness);
    assert.ok(!isGlowing(block));
    harness.sync.dispose();
  });

  test("does not clear a peer's selection glow once their drag stream ends", () => {
    const harness = createLiveSyncHarness();
    const block = harness.addBlock();

    block.emphasize("#112233", "selection:bob");
    publishLive(harness, block.uuid, 5);
    clearLive(harness);

    assert.ok(isGlowing(block), "bob's selection glow must survive the end of their drag stream");
    block.clearEmphasis("selection:bob");
    harness.sync.dispose();
  });

  test("leaves the block at its last live position on dispose", () => {
    const harness = createLiveSyncHarness();
    const block = harness.addBlock();

    publishLive(harness, block.uuid, 5);
    harness.sync.dispose();

    assert.equal(block.position.x, 5);
  });

  test("publishes a throttled live transform that ends on the latest one, and null on clear", (t) => {
    t.mock.timers.enable({ apis: ["Date", "setTimeout"], now: 1000 });
    const harness = createLiveSyncHarness();
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
    const harness = createLiveSyncHarness();
    const block = harness.addBlock();

    harness.view.show(WAVE);
    harness.sync.publish(block.uuid, block.transform);

    assert.deepEqual(harness.published, [{
      transformLive: { uuid: block.uuid, transform: block.transform, view: WAVE }
    }]);
    harness.sync.dispose();
  });
});
