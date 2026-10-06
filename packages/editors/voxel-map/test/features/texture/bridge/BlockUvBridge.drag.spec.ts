// Import Node.js Dependencies
import {
  beforeEach,
  describe,
  it
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { BlockUvBridge } from "../../../../src/features/texture/bridge/BlockUvBridge.ts";
import {
  makeBlock,
  makeFakeVoxelEngine,
  makeUv,
  blocksetSlot
} from "./blockUvFixtures.ts";

// CONSTANTS
const kFrames = new Map<number, FrameRequestCallback>();
let nextFrame = 1;

globalThis.requestAnimationFrame = (callback) => {
  const id = nextFrame++;
  kFrames.set(id, callback);

  return id;
};
globalThis.cancelAnimationFrame = (id) => {
  kFrames.delete(id);
};

function runFrame(): void {
  const callbacks = [...kFrames.values()];
  kFrames.clear();
  for (const callback of callbacks) {
    callback(0);
  }
}

function setup() {
  const engine = makeFakeVoxelEngine();
  engine.view.document.blocks.register(
    makeBlock(1, { col: 0, row: 0, blocksetId: "atlas" })
  );
  const uv = makeUv();
  const bridge = new BlockUvBridge(uv, engine.view, engine.bridgeOptions);
  bridge.setActiveBlockset(blocksetSlot("atlas"), 16);

  return { ...engine, uv, bridge };
}

describe("BlockUvBridge / region-dragging", () => {
  beforeEach(() => kFrames.clear());

  it("writes the latest dragged rect once per frame", () => {
    const { view, dirtyReasons, uv, bridge } = setup();
    try {
      uv.previewMove("block-1", { x: 16, y: 0, width: 16, height: 16 });
      uv.previewMove("block-1", { x: 32, y: 0, width: 16, height: 16 });
      uv.previewMove("block-1", { x: 48, y: 16, width: 16, height: 16 });
      assert.deepEqual(dirtyReasons, []);

      runFrame();

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

  it("writes every region dragged in the same frame once", () => {
    const engine = makeFakeVoxelEngine();
    engine.view.document.blocks.register(
      makeBlock(1, { col: 0, row: 0, blocksetId: "atlas" })
    );
    engine.view.document.blocks.register(
      makeBlock(2, { col: 1, row: 0, blocksetId: "atlas" })
    );
    const uv = makeUv();
    const bridge = new BlockUvBridge(uv, engine.view, engine.bridgeOptions);
    bridge.setActiveBlockset(blocksetSlot("atlas"), 16);
    engine.dirtyReasons.length = 0;
    try {
      uv.previewMoveGroup([
        { id: "block-1", rect: { x: 0, y: 16, width: 16, height: 16 }, slot: null },
        { id: "block-2", rect: { x: 16, y: 16, width: 16, height: 16 }, slot: null }
      ]);
      assert.deepEqual(engine.dirtyReasons, []);

      runFrame();

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

  it("skips the frame when the drag is back on the block's rect", () => {
    const { dirtyReasons, uv, bridge } = setup();
    try {
      uv.previewMove("block-1", { x: 16, y: 0, width: 16, height: 16 });
      uv.previewMove("block-1", { x: 0, y: 0, width: 16, height: 16 });
      runFrame();

      assert.deepEqual(dirtyReasons, []);
    }
    finally {
      bridge.dispose();
    }
  });

  it("lets the drop win over a pending frame", () => {
    const { view, dirtyReasons, uv, bridge } = setup();
    try {
      uv.previewMove("block-1", { x: 16, y: 0, width: 16, height: 16 });
      uv.move("block-1", { x: 32, y: 0, width: 16, height: 16 });
      runFrame();

      assert.deepEqual(dirtyReasons, ["block-defined"]);
      assert.equal(view.document.blocks.get(1)?.defaultTexture?.col, 2);
    }
    finally {
      bridge.dispose();
    }
  });

  it("writes the pending rect as soon as the drag ends", () => {
    const { view, uv, bridge } = setup();
    try {
      uv.previewMove("block-1", { x: 16, y: 0, width: 16, height: 16 });
      uv.emit("region-drag-ended", { id: "block-1", committed: false });

      assert.equal(view.document.blocks.get(1)?.defaultTexture?.col, 1);
      assert.equal(kFrames.size, 0);
    }
    finally {
      bridge.dispose();
    }
  });

  it("drops the pending frame on dispose", () => {
    const { dirtyReasons, uv, bridge } = setup();
    uv.previewMove("block-1", { x: 16, y: 0, width: 16, height: 16 });
    bridge.dispose();
    runFrame();

    assert.deepEqual(dirtyReasons, []);
  });
});
