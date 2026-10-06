// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { BlockUvBridge } from "../../../../src/features/texture/bridge/BlockUvBridge.ts";
import { BlockUv } from "../../../../src/features/texture/uv/BlockUv.ts";
import {
  makeBlock,
  makeFakeVoxelEngine,
  makeUv,
  blocksetSlot
} from "./blockUvFixtures.ts";

function setupShape(
  shapeId: string
) {
  const { view, bridgeOptions } = makeFakeVoxelEngine();
  const uv = makeUv();
  view.document.defineBlock({
    id: 1,
    name: shapeId,
    shapeId,
    collidable: true,
    properties: {},
    faceTextures: {},
    defaultTexture: { col: 2, row: 2, blocksetId: "atlas" }
  });
  const bridge = new BlockUvBridge(uv, view, bridgeOptions);
  bridge.setActiveBlockset(blocksetSlot("atlas"), 16);

  return { view, uv, bridge };
}

describe("BlockUvBridge / rotation", () => {
  it("rotating a stacked block writes its default tile rotation in place", () => {
    const { view, bridgeOptions } = makeFakeVoxelEngine();
    view.document.blocks.register(makeBlock(1, { col: 1, row: 2, blocksetId: "atlas" }));
    const uv = makeUv();
    const bridge = new BlockUvBridge(uv, view, bridgeOptions);
    try {
      bridge.setActiveBlockset(blocksetSlot("atlas"), 16);

      uv.rotate("block-1", "cw");

      const rotated = view.document.blocks.get(1)!;
      assert.deepEqual(rotated.defaultTexture, {
        col: 1,
        row: 2,
        blocksetId: "atlas",
        rotation: 1
      });
      assert.deepEqual(rotated.faceTextures, {});

      uv.rotate("block-1", "ccw");

      assert.deepEqual(view.document.blocks.get(1)!.defaultTexture, {
        col: 1,
        row: 2,
        blocksetId: "atlas"
      });
    }
    finally {
      bridge.dispose();
    }
  });

  it("builds a rotated stacked region from a rotated default tile", () => {
    const { view, bridgeOptions } = makeFakeVoxelEngine();
    view.document.blocks.register({
      ...makeBlock(1, { col: 1, row: 2, blocksetId: "atlas" }),
      defaultTexture: { col: 1, row: 2, blocksetId: "atlas", rotation: 2 }
    });
    const uv = makeUv();
    const bridge = new BlockUvBridge(uv, view, bridgeOptions);
    try {
      bridge.setActiveBlockset(blocksetSlot("atlas"), 16);

      assert.deepEqual(uv.get("block-1")!.geometryFor("top"), {
        x: 16,
        y: 32,
        width: 16,
        height: 16,
        rotation: 2
      });
    }
    finally {
      bridge.dispose();
    }
  });

  it("rotating one free face writes only that face's tile rotation", () => {
    const { view, bridgeOptions } = makeFakeVoxelEngine();
    view.document.blocks.register(makeBlock(1, { col: 1, row: 2, blocksetId: "atlas" }));
    const uv = makeUv();
    const bridge = new BlockUvBridge(uv, view, bridgeOptions);
    try {
      bridge.setActiveBlockset(blocksetSlot("atlas"), 16);
      uv.setState("block-1", "free");

      uv.rotate("block-1", "cw", "top");

      const { faceTextures } = view.document.blocks.get(1)!;
      assert.deepEqual(faceTextures.top, {
        col: 1,
        row: 2,
        blocksetId: "atlas",
        rotation: 1
      });
      assert.equal(faceTextures.front.rotation, undefined);
    }
    finally {
      bridge.dispose();
    }
  });

  for (const [shapeId, slot] of [["stair", "back.1"], ["ramp", "left"], ["ramp", "top"]]) {
    it(`a rotated ${shapeId} "${slot}" slot survives the round trip through its tile`, () => {
      const { view, uv, bridge } = setupShape(shapeId);
      try {
        uv.setState("block-1", "free");

        uv.rotate("block-1", "cw", slot);

        const block = view.document.blocks.get(1)!;
        assert.equal(block.faceTextures[slot].rotation, 1);
        assert.deepEqual(
          new BlockUv(block, view.shapes.get(block.shapeId), 16).region().geometryFor(slot),
          uv.get("block-1")!.geometryFor(slot)
        );
      }
      finally {
        bridge.dispose();
      }
    });
  }
});
