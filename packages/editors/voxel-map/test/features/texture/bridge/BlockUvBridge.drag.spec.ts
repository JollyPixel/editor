// Import Node.js Dependencies
import {
  describe,
  it,
  type TestContext
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { BlockUvBridge } from "../../../../src/features/texture/bridge/BlockUvBridge.ts";
import type { UvSyncMode } from "../../../../src/state/index.ts";
import {
  makeBlock,
  makeFakeVoxelEngine,
  makeUv,
  blocksetSlot
} from "./blockUvFixtures.ts";
import { FakeFrames } from "../../../helpers/frames.ts";

function setup(
  t: TestContext,
  mode: UvSyncMode = "commit"
) {
  const frames = new FakeFrames(t);
  const engine = makeFakeVoxelEngine();
  engine.view.document.blocks.register(
    makeBlock(1, { col: 0, row: 0, blocksetId: "atlas" })
  );
  engine.bridgeOptions.uvSync.value = mode;
  const uv = makeUv();
  const bridge = new BlockUvBridge(uv, engine.view, engine.bridgeOptions);
  bridge.activateBlockset(blocksetSlot("atlas"), 16);

  return { ...engine, uv, bridge, frames };
}

describe("BlockUvBridge / region-dragging in live mode", () => {
  it("writes the latest dragged rect once per frame", (t) => {
    const { view, dirtyReasons, uv, bridge, frames } = setup(t, "live");
    try {
      uv.previewMove("block-1", { x: 16, y: 0, width: 16, height: 16 });
      uv.previewMove("block-1", { x: 32, y: 0, width: 16, height: 16 });
      uv.previewMove("block-1", { x: 48, y: 16, width: 16, height: 16 });
      assert.deepEqual(dirtyReasons, []);

      frames.run();

      assert.deepEqual(dirtyReasons, ["block-defined"]);
      assert.deepEqual(view.document.blocks.get(1)?.defaultTexture, {
        col: 3,
        row: 1,
        blocksetId: "atlas"
      });
    }
    finally {
      bridge.dispose();
    }
  });

  it("writes every region dragged in the same frame once", (t) => {
    const frames = new FakeFrames(t);
    const engine = makeFakeVoxelEngine();
    engine.view.document.blocks.register(
      makeBlock(1, { col: 0, row: 0, blocksetId: "atlas" })
    );
    engine.view.document.blocks.register(
      makeBlock(2, { col: 1, row: 0, blocksetId: "atlas" })
    );
    const uv = makeUv();
    engine.bridgeOptions.uvSync.value = "live";
    const bridge = new BlockUvBridge(uv, engine.view, engine.bridgeOptions);
    bridge.activateBlockset(blocksetSlot("atlas"), 16);
    engine.dirtyReasons.length = 0;
    try {
      uv.previewMoveGroup([
        { id: "block-1", rect: { x: 0, y: 16, width: 16, height: 16 }, slot: null },
        { id: "block-2", rect: { x: 16, y: 16, width: 16, height: 16 }, slot: null }
      ]);
      assert.deepEqual(engine.dirtyReasons, []);

      frames.run();

      assert.deepEqual(engine.dirtyReasons, ["block-defined", "block-defined"]);
      assert.deepEqual(
        [1, 2].map((id) => engine.view.document.blocks.get(id)?.defaultTexture?.row),
        [1, 1]
      );
    }
    finally {
      bridge.dispose();
    }
  });

  it("skips the frame when the drag is back on the block's rect", (t) => {
    const { dirtyReasons, uv, bridge, frames } = setup(t, "live");
    try {
      uv.previewMove("block-1", { x: 16, y: 0, width: 16, height: 16 });
      uv.previewMove("block-1", { x: 0, y: 0, width: 16, height: 16 });
      frames.run();

      assert.deepEqual(dirtyReasons, []);
    }
    finally {
      bridge.dispose();
    }
  });

  it("lets the drop win over a pending frame", (t) => {
    const { view, dirtyReasons, uv, bridge, frames } = setup(t, "live");
    try {
      uv.previewMove("block-1", { x: 16, y: 0, width: 16, height: 16 });
      uv.move("block-1", { x: 32, y: 0, width: 16, height: 16 });
      frames.run();

      assert.deepEqual(dirtyReasons, ["block-defined"]);
      assert.equal(view.document.blocks.get(1)?.defaultTexture?.col, 2);
    }
    finally {
      bridge.dispose();
    }
  });

  it("writes the pending rect as soon as the drag ends", (t) => {
    const { view, uv, bridge, frames } = setup(t, "live");
    try {
      uv.previewMove("block-1", { x: 16, y: 0, width: 16, height: 16 });
      uv.emit("region-drag-ended", { id: "block-1", committed: false });

      assert.equal(view.document.blocks.get(1)?.defaultTexture?.col, 1);
      assert.equal(frames.length, 0);
    }
    finally {
      bridge.dispose();
    }
  });

  it("drops the pending frame on dispose", (t) => {
    const { dirtyReasons, uv, bridge, frames } = setup(t, "live");
    uv.previewMove("block-1", { x: 16, y: 0, width: 16, height: 16 });
    bridge.dispose();
    frames.run();

    assert.deepEqual(dirtyReasons, []);
  });
});

describe("BlockUvBridge / region-dragging in commit mode", () => {
  it("writes nothing while the region is dragged", (t) => {
    const { view, dirtyReasons, uv, bridge, frames } = setup(t);
    try {
      uv.previewMove("block-1", { x: 16, y: 0, width: 16, height: 16 });
      uv.previewMove("block-1", { x: 32, y: 0, width: 16, height: 16 });
      frames.run();

      assert.deepEqual(dirtyReasons, []);
      assert.equal(frames.length, 0);
      assert.equal(view.document.blocks.get(1)?.defaultTexture?.col, 0);
    }
    finally {
      bridge.dispose();
    }
  });

  it("writes the dropped rect once", (t) => {
    const { view, dirtyReasons, uv, bridge } = setup(t);
    try {
      uv.previewMove("block-1", { x: 16, y: 0, width: 16, height: 16 });
      uv.move("block-1", { x: 32, y: 0, width: 16, height: 16 });
      uv.endPreview("block-1", true);

      assert.deepEqual(dirtyReasons, ["block-defined"]);
      assert.equal(view.document.blocks.get(1)?.defaultTexture?.col, 2);
    }
    finally {
      bridge.dispose();
    }
  });

  it("writes nothing for a cancelled drag", (t) => {
    const { view, dirtyReasons, uv, bridge } = setup(t);
    try {
      uv.previewMove("block-1", { x: 16, y: 0, width: 16, height: 16 });
      uv.previewMove("block-1", { x: 0, y: 0, width: 16, height: 16 });
      uv.endPreview("block-1", false);

      assert.deepEqual(dirtyReasons, []);
      assert.equal(view.document.blocks.get(1)?.defaultTexture?.col, 0);
    }
    finally {
      bridge.dispose();
    }
  });

  it("follows a switch to live mode on the next drag", (t) => {
    const { view, uv, bridgeOptions, bridge, frames } = setup(t);
    try {
      bridgeOptions.uvSync.value = "live";
      uv.previewMove("block-1", { x: 16, y: 0, width: 16, height: 16 });
      frames.run();

      assert.equal(view.document.blocks.get(1)?.defaultTexture?.col, 1);
    }
    finally {
      bridge.dispose();
    }
  });
});
