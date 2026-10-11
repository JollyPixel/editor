// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Internal Dependencies
import {
  RUN,
  WAVE,
  clearLive,
  createLiveSyncHarness,
  createView,
  isGlowing,
  publishLive
} from "./liveSyncHarness.ts";

describe("TransformLiveSync clip gating", () => {
  test("shows a peer keying the clip I pose, and ignores one keying another clip", () => {
    const view = createView();
    view.show(WAVE);
    const harness = createLiveSyncHarness(view);
    const block = harness.addBlock();

    publishLive(harness, block.uuid, 5, RUN);
    assert.equal(block.position.x, 0);

    publishLive(harness, block.uuid, 6, WAVE);
    assert.equal(block.position.x, 6);
    harness.sync.dispose();
  });

  test("ignores a drag whose view is not an animation key", () => {
    const view = createView();
    view.show(WAVE);
    const harness = createLiveSyncHarness(view);
    const block = harness.addBlock();

    publishLive(harness, block.uuid, 5, "walk:wave");
    assert.equal(block.position.x, 0);
    harness.sync.dispose();
  });

  test("ignores rest pose drags while I pose a clip, and clip drags while I show the rest pose", () => {
    const view = createView();
    const harness = createLiveSyncHarness(view);
    const block = harness.addBlock();

    publishLive(harness, block.uuid, 5, WAVE);
    assert.equal(block.position.x, 0);

    view.show(WAVE);
    publishLive(harness, block.uuid, 6);
    assert.equal(block.position.x, 0);
    harness.sync.dispose();
  });

  test("hands a stream back to my own pose when I leave its clip", () => {
    const view = createView();
    view.show(WAVE);
    const harness = createLiveSyncHarness(view);
    const block = harness.addBlock();

    publishLive(harness, block.uuid, 5, WAVE);
    view.show(RUN);

    assert.equal(block.position.x, 0);
    assert.ok(!isGlowing(block));
    harness.sync.dispose();
  });

  test("re-poses a block once a clip drag is cleared, since its key may land on another tick", () => {
    const view = createView();
    view.show(WAVE);
    const harness = createLiveSyncHarness(view);
    const block = harness.addBlock();

    publishLive(harness, block.uuid, 5, WAVE);
    clearLive(harness);

    assert.equal(block.position.x, 0);
    harness.sync.dispose();
  });
});
