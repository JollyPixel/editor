// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  PixelDocument,
  type PixelBufferHookEvent
} from "@jolly-pixel/pixel-draw.renderer";
import {
  createBlockTransform,
  createBlockUv,
  type ModelChange,
  type UVLayoutData,
  type VoxelModelSnapshot
} from "@jolly-pixel/asset.voxel-model/network/client.ts";

// Import Internal Dependencies
import { BlockTextures } from "#src/features/texture/BlockTextures.ts";
import type { ModelBlock } from "#src/scene/blocks/index.ts";
import { createModelFixture } from "../../fixtures/model.ts";

// CONSTANTS
const kTextureSize = { x: 256, y: 256 };
const kTorsoRegionId = "block-torso";

function stackedAt(
  x: number,
  y = 0
): UVLayoutData {
  return {
    state: "stacked",
    rect: { x, y, width: 16, height: 16 }
  };
}

function torsoSnapshot(
  uv: UVLayoutData
): VoxelModelSnapshot {
  return {
    nodes: [
      {
        kind: "block",
        id: "torso",
        parentId: null,
        name: "Torso",
        transform: createBlockTransform(),
        uv
      }
    ]
  };
}

function createHarness() {
  const pixelEvents: PixelBufferHookEvent[] = [];
  const pixels = new PixelDocument({
    size: kTextureSize,
    history: { enabled: true },
    onBufferUpdated: (event) => pixelEvents.push(event)
  });
  const { document, blocks, selection, addBlock } = createModelFixture();
  const textures = new BlockTextures({
    pixels,
    document,
    blocks,
    selection
  });
  const changes: ModelChange[] = [];
  document.on("change", (change) => changes.push(change));

  return {
    pixels,
    pixelEvents,
    uv: pixels.uv,
    document,
    blocks,
    selection,
    addBlock,
    textures,
    changes
  };
}

function uvOf(
  block: ModelBlock,
  index: number
): [number, number] {
  const attribute = block.mesh.geometry.getAttribute("uv");

  return [attribute.getX(index), attribute.getY(index)];
}

function regionIdOf(
  block: ModelBlock
): string {
  return `block-${block.uuid}`;
}

describe("BlockTextures texture", () => {
  test("shares one texture across existing and future blocks", () => {
    const pixels = new PixelDocument({ size: kTextureSize });
    const { document, blocks, selection, addBlock } = createModelFixture();
    const before = addBlock();
    new BlockTextures({
      pixels,
      document,
      blocks,
      selection
    });
    const after = addBlock();

    assert.ok(before.texture);
    assert.equal(after.texture, before.texture);
  });

  test("owns block regions while attached and gives them back on dispose", () => {
    const { pixels, textures } = createHarness();
    const regionId = "block-a";

    assert.equal(pixels.ownsUvRegion(regionId), false);
    assert.equal(pixels.ownsUvRegion("texture-region"), true);
    textures.dispose();
    assert.equal(pixels.ownsUvRegion(regionId), true);
  });

  test("keeps syncing the texture's own regions", () => {
    const { pixels, pixelEvents } = createHarness();

    pixels.uv.create({
      id: "texture-region",
      width: 4,
      height: 4
    });

    assert.deepEqual(
      pixelEvents.map((event) => event.action),
      ["uv-region-created"]
    );
  });
});

describe("BlockTextures model layouts", () => {
  test("maps a block's stored UV layout onto the mesh", () => {
    const { addBlock, uv } = createHarness();
    const block = addBlock({ uv: stackedAt(0) });

    assert.equal(uv.get(regionIdOf(block))?.name, "Block");
    assert.deepEqual(uvOf(block, 1), [16 / kTextureSize.x, 1]);
  });

  test("maps a remote block added with its UV layout", () => {
    const { document, blocks } = createHarness();

    document.apply({
      action: "node-added",
      node: {
        kind: "block",
        id: "late",
        parentId: null,
        name: "Late",
        transform: createBlockTransform(),
        uv: stackedAt(32)
      }
    });

    const block = blocks.get("late");
    assert.ok(block);
    assert.deepEqual(uvOf(block, 1), [48 / kTextureSize.x, 1]);
  });

  test("shows the default net of a block added without a layout", () => {
    const { addBlock, uv, changes } = createHarness();
    const block = addBlock({ name: "Head" });

    assert.equal(uv.get(regionIdOf(block))?.state, "unfolded");
    assert.equal(uv.get(regionIdOf(block))?.name, "Head");
    assert.deepEqual(
      changes.map((change) => change.command.action),
      ["node-added"]
    );
  });

  test("binds the layout of a snapshot block", () => {
    const { document, blocks, uv } = createHarness();
    document.load(torsoSnapshot(createBlockUv()));

    assert.equal(uv.get(kTorsoRegionId)?.name, "Torso");

    const block = blocks.get("torso");
    assert.ok(block);
    uv.move(kTorsoRegionId, { x: 0, y: 0, width: 48, height: 32 });
    const [u, v] = uvOf(block, 1);
    uv.move(kTorsoRegionId, { x: 64, y: 0, width: 48, height: 32 });

    assert.deepEqual(uvOf(block, 1), [u + (64 / kTextureSize.x), v]);
  });

  test("the model layout wins over a region the texture carries", () => {
    const { document, uv } = createHarness();
    uv.create({ id: kTorsoRegionId, width: 16, height: 16 });
    uv.move(kTorsoRegionId, { x: 64, y: 32, width: 16, height: 16 });

    document.load(torsoSnapshot(stackedAt(0)));

    assert.deepEqual(
      uv.get(kTorsoRegionId)?.geometryFor("front"),
      { x: 0, y: 0, width: 16, height: 16 }
    );
  });

  test("updates the regions of blocks a reset keeps, without re-creating them", () => {
    const { document, uv } = createHarness();
    document.load(torsoSnapshot(stackedAt(0)));
    const deleted: string[] = [];
    uv.on("region-deleted", ({ region }) => deleted.push(region.id));

    document.load(torsoSnapshot(stackedAt(32)));

    assert.deepEqual(deleted, []);
    assert.deepEqual(
      uv.get(kTorsoRegionId)?.geometryFor("front"),
      { x: 32, y: 0, width: 16, height: 16 }
    );
  });

  test("drops texture regions of blocks the model does not have", () => {
    const { document, uv } = createHarness();
    uv.create({ id: "block-ghost", width: 16, height: 16 });
    uv.create({ id: "unrelated", width: 16, height: 16 });

    document.load(torsoSnapshot(stackedAt(0)));

    assert.equal(uv.get("block-ghost"), undefined);
    assert.ok(uv.get("unrelated"));
  });

  test("keeps every block region through a texture snapshot", (context) => {
    Object.defineProperty(globalThis, "requestAnimationFrame", {
      value: () => 0,
      configurable: true
    });
    context.after(() => {
      Reflect.deleteProperty(globalThis, "requestAnimationFrame");
    });
    const { pixels, addBlock, uv } = createHarness();
    const block = addBlock({ uv: stackedAt(32) });

    pixels.loadSnapshot(
      kTextureSize,
      new Uint8ClampedArray(kTextureSize.x * kTextureSize.y * 4)
    );

    assert.deepEqual(
      uv.get(regionIdOf(block))?.geometryFor("front"),
      { x: 32, y: 0, width: 16, height: 16 }
    );
    assert.deepEqual(uvOf(block, 1), [48 / kTextureSize.x, 1]);
  });

  test("deletes a block's region when the block is removed", () => {
    const { document, addBlock, uv } = createHarness();
    const block = addBlock({ uv: stackedAt(0) });
    assert.ok(uv.get(regionIdOf(block)));

    document.remove(block.uuid);

    assert.equal(uv.get(regionIdOf(block)), undefined);
  });
});

describe("BlockTextures UV edits", () => {
  function bound() {
    const harness = createHarness();
    const block = harness.addBlock({ uv: stackedAt(0) });
    harness.changes.length = 0;

    return {
      ...harness,
      block,
      regionId: regionIdOf(block)
    };
  }

  test("writes a moved region to the model as one command", () => {
    const { document, uv, block, regionId, changes } = bound();

    uv.move(regionId, { x: 64, y: 32, width: 16, height: 16 });

    assert.deepEqual(uvOf(block, 1), [80 / kTextureSize.x, 1 - (32 / kTextureSize.y)]);
    assert.deepEqual(document.tree.block(block.uuid)?.uv, stackedAt(64, 32));
    assert.deepEqual(
      changes.map((change) => change.command.action),
      ["node-uv-changed"]
    );
  });

  test("sends no texture command and records no texture history", () => {
    const { pixels, pixelEvents, uv, regionId } = bound();

    uv.move(regionId, { x: 64, y: 32, width: 16, height: 16 });
    uv.rotate(regionId, "cw");
    uv.setState(regionId, "unfolded");

    assert.deepEqual(pixelEvents, []);
    assert.equal(pixels.history.canUndo, false);
  });

  test("applies a remote UV change to the region without echoing it", () => {
    const { document, uv, block, regionId, changes } = bound();

    document.apply({
      action: "node-uv-changed",
      id: block.uuid,
      uv: stackedAt(64, 32)
    });

    assert.deepEqual(
      uv.get(regionId)?.geometryFor("front"),
      { x: 64, y: 32, width: 16, height: 16 }
    );
    assert.deepEqual(
      changes.map((change) => [change.command.action, change.origin]),
      [["node-uv-changed", "remote"]]
    );
  });

  test("maps a region while it is still being dragged, without a command", () => {
    const { uv, block, regionId, changes } = bound();

    uv.previewMove(regionId, { x: 64, y: 32, width: 16, height: 16 });

    assert.deepEqual(uvOf(block, 1), [80 / kTextureSize.x, 1 - (32 / kTextureSize.y)]);
    assert.deepEqual(uv.get(regionId)?.geometryFor("front"), { x: 0, y: 0, width: 16, height: 16 });
    assert.deepEqual(changes, []);
  });

  test("writes a rotated region, turning each face's UVs a quarter clockwise", () => {
    const { document, uv, block, regionId } = bound();

    uv.rotate(regionId, "cw");

    assert.deepEqual(uvOf(block, 0), [16 / kTextureSize.x, 1]);
    assert.deepEqual(uvOf(block, 1), [16 / kTextureSize.x, 1 - (16 / kTextureSize.y)]);
    assert.deepEqual(
      document.tree.block(block.uuid)?.uv,
      {
        state: "stacked",
        rect: { x: 0, y: 0, width: 16, height: 16, rotation: 1 }
      }
    );
  });

  test("applies a peer's in-progress drag without touching the region", () => {
    const { uv, block, regionId, textures } = bound();

    textures.previewPeerDrag({
      id: regionId,
      face: null,
      geometry: { x: 64, y: 32, width: 16, height: 16 }
    });

    assert.deepEqual(uvOf(block, 1), [80 / kTextureSize.x, 1 - (32 / kTextureSize.y)]);
    assert.deepEqual(uv.get(regionId)?.geometryFor("front"), { x: 0, y: 0, width: 16, height: 16 });
  });

  test("ignores regions and peer drags that belong to no block", () => {
    const { uv, textures, changes } = bound();
    uv.create({ id: "unrelated-region", width: 16, height: 16 });

    assert.doesNotThrow(() => uv.move("unrelated-region", { x: 8, y: 8, width: 16, height: 16 }));
    assert.doesNotThrow(() => textures.previewPeerDrag({
      id: "block-missing",
      face: null,
      geometry: { x: 0, y: 0, width: 16, height: 16 }
    }));
    assert.deepEqual(changes, []);
  });

  test("swaps the axis-perpendicular faces and mirrors U on the rest, for an X mirror", () => {
    const { document, uv, block, regionId } = bound();
    uv.setState(regionId, "free");
    uv.move(regionId, { x: 0, y: 0, width: 16, height: 16 }, "right");
    uv.move(regionId, { x: 100, y: 0, width: 16, height: 16 }, "left");
    uv.move(regionId, { x: 0, y: 100, width: 16, height: 16 }, "front");

    document.transform(block.uuid, block.transform, { x: true, y: false, z: false });

    assert.equal(uvOf(block, 0)[0], 100 / kTextureSize.x);
    assert.equal(uvOf(block, 1)[0], 116 / kTextureSize.x);
    assert.equal(uvOf(block, 16)[0], 16 / kTextureSize.x);
    assert.equal(uvOf(block, 17)[0], 0);
  });

  test("honors flipAxes already recorded on first mapping", () => {
    const { document, blocks, uv, regionId, block } = bound();
    uv.setState(regionId, "free");
    uv.move(regionId, { x: 0, y: 0, width: 16, height: 16 }, "right");
    uv.move(regionId, { x: 100, y: 0, width: 16, height: 16 }, "left");

    document.apply({
      action: "node-added",
      node: {
        kind: "block",
        id: "mirrored",
        parentId: null,
        name: "Mirrored",
        transform: createBlockTransform(),
        flipAxes: { x: true, y: false, z: false },
        uv: document.tree.block(block.uuid)!.uv
      }
    });

    const mirrored = blocks.get("mirrored");
    assert.ok(mirrored);
    assert.equal(uvOf(mirrored, 0)[0], 100 / kTextureSize.x);
    assert.equal(uvOf(mirrored, 16)[0], 16 / kTextureSize.x);
  });
});

describe("BlockTextures rename", () => {
  test("a local block rename renames its region in place", () => {
    const { document, addBlock, uv } = createHarness();
    const block = addBlock({ name: "Torso", uv: stackedAt(32) });
    const before = uv.get(regionIdOf(block))?.toJSON();
    assert.ok(before);

    document.rename(block.uuid, "Chest");

    assert.deepEqual(
      uv.get(regionIdOf(block))?.toJSON(),
      { ...before, name: "Chest" }
    );
  });

  test("a remote block rename renames its region too", () => {
    const { document, addBlock, uv } = createHarness();
    const block = addBlock({ name: "Torso", uv: stackedAt(0) });

    document.apply({
      action: "node-renamed",
      id: block.uuid,
      name: "Chest"
    });

    assert.equal(block.name, "Chest");
    assert.equal(uv.get(regionIdOf(block))?.name, "Chest");
  });

  test("keeps the renamed region mapped onto the mesh", () => {
    const { document, addBlock, uv } = createHarness();
    const block = addBlock({ name: "Torso", uv: stackedAt(0) });
    document.rename(block.uuid, "Chest");

    uv.move(regionIdOf(block), { x: 32, y: 0, width: 16, height: 16 });

    assert.deepEqual(uvOf(block, 1), [48 / kTextureSize.x, 1]);
  });
});

describe("BlockTextures selection", () => {
  test("selecting a block selects its region, and the reverse", () => {
    const { selection, addBlock, uv } = createHarness();
    const first = addBlock({ uv: stackedAt(0) });
    const second = addBlock({ uv: stackedAt(32) });

    selection.select(first.uuid);
    assert.equal(uv.selectedRegionId, regionIdOf(first));

    uv.select(regionIdOf(second));
    assert.equal(selection.selected, second.uuid);
  });
});
