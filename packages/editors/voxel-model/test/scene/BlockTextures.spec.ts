// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";
import {
  DEFAULT_UV_SLOTS,
  PixelDocument
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import { BlockTextures } from "#src/scene/BlockTextures.ts";
import {
  ModelDocument,
  type ModelBlock
} from "#src/model/index.ts";

// CONSTANTS
const kTextureSize = { x: 256, y: 256 };
const kTorsoRegionId = "block-torso";
const kTorsoSnapshot = {
  nodes: [
    {
      uuid: "torso",
      name: "Torso",
      parentUuid: null,
      position: { x: 0, y: 0, z: 0 },
      pivotOffset: { x: 0, y: 0, z: 0 },
      size: { x: 1, y: 1, z: 1 },
      scale: { x: 1, y: 1, z: 1 },
      rotation: { x: 0, y: 0, z: 0 }
    }
  ],
  folders: [],
  placements: []
};

function createPixels(): PixelDocument {
  return new PixelDocument({
    size: kTextureSize
  });
}

function createHarness(
  pixelsReady: Promise<void> = Promise.resolve()
) {
  const pixels = createPixels();
  const document = new ModelDocument(new THREE.Scene());
  const textures = new BlockTextures({
    pixels,
    pixelsReady,
    document
  });

  return {
    pixels,
    uv: pixels.uv,
    document,
    blocks: document.blocks,
    textures
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
    const pixels = createPixels();
    const document = new ModelDocument(new THREE.Scene());
    const before = document.blocks.add();
    new BlockTextures({
      pixels,
      pixelsReady: Promise.resolve(),
      document
    });
    const after = document.blocks.add();

    assert.ok(before.texture);
    assert.equal(after.texture, before.texture);
  });
});

describe("BlockTextures region binding", () => {
  test("maps a region created after its block onto the mesh", () => {
    const { blocks, uv } = createHarness();
    const block = blocks.add({ name: "Block" });

    uv.create({ id: regionIdOf(block), width: 16, height: 16 });
    uv.move(regionIdOf(block), { x: 0, y: 0, width: 16, height: 16 });

    assert.deepEqual(uvOf(block, 1), [16 / kTextureSize.x, 1]);
  });

  test("maps an existing region onto a block added later", () => {
    const { document, uv } = createHarness();
    uv.create({ id: "block-late", width: 16, height: 16 });
    uv.move("block-late", { x: 32, y: 0, width: 16, height: 16 });

    document.apply({
      action: "group-added",
      uuid: "late",
      name: "Late",
      transform: {
        position: { x: 0, y: 0, z: 0 },
        pivotOffset: { x: 0, y: 0, z: 0 },
        size: { x: 1, y: 1, z: 1 },
        scale: { x: 1, y: 1, z: 1 },
        rotation: { x: 0, y: 0, z: 0 }
      }
    });

    const block = document.blocks.get("late");
    assert.ok(block);
    assert.deepEqual(uvOf(block, 1), [48 / kTextureSize.x, 1]);
  });

  test("honors flipAxes already recorded on first mapping", () => {
    const { document, blocks, uv } = createHarness();
    const block = blocks.add({ name: "Block" });
    const regionId = regionIdOf(block);
    document.apply({
      action: "group-transformed",
      uuid: block.uuid,
      transform: block.transform,
      flipAxes: { x: true, y: false, z: false }
    });

    uv.create({
      id: regionId,
      width: 16,
      height: 16,
      state: "free",
      activeSlots: DEFAULT_UV_SLOTS
    });
    uv.move(regionId, { x: 0, y: 0, width: 16, height: 16 }, "right");
    uv.move(regionId, { x: 100, y: 0, width: 16, height: 16 }, "left");

    assert.equal(uvOf(block, 0)[0], 100 / kTextureSize.x);
    assert.equal(uvOf(block, 16)[0], 16 / kTextureSize.x);
  });
});

describe("BlockTextures live region updates", () => {
  function bound() {
    const harness = createHarness();
    const block = harness.blocks.add({ name: "Block" });
    const regionId = regionIdOf(block);
    harness.uv.create({ id: regionId, width: 16, height: 16 });
    harness.uv.move(regionId, { x: 0, y: 0, width: 16, height: 16 });

    return { ...harness, block, regionId };
  }

  test("re-applies the region when it moves", () => {
    const { uv, block, regionId } = bound();

    uv.move(regionId, { x: 64, y: 32, width: 16, height: 16 });

    assert.deepEqual(uvOf(block, 1), [80 / kTextureSize.x, 1 - (32 / kTextureSize.y)]);
  });

  test("re-applies the region while it is still being dragged", () => {
    const { uv, block, regionId } = bound();

    uv.previewMove(regionId, { x: 64, y: 32, width: 16, height: 16 });

    assert.deepEqual(uvOf(block, 1), [80 / kTextureSize.x, 1 - (32 / kTextureSize.y)]);
    assert.deepEqual(uv.get(regionId)?.geometryFor("front"), { x: 0, y: 0, width: 16, height: 16 });
  });

  test("re-applies a rotated region, turning each face's UVs a quarter clockwise", () => {
    const { uv, block, regionId } = bound();

    uv.rotate(regionId, "cw");

    assert.deepEqual(uvOf(block, 0), [16 / kTextureSize.x, 1]);
    assert.deepEqual(uvOf(block, 1), [16 / kTextureSize.x, 1 - (16 / kTextureSize.y)]);
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
    const { uv, textures } = bound();
    uv.create({ id: "unrelated-region", width: 16, height: 16 });

    assert.doesNotThrow(() => uv.move("unrelated-region", { x: 8, y: 8, width: 16, height: 16 }));
    assert.doesNotThrow(() => textures.previewPeerDrag({
      id: "block-missing",
      face: null,
      geometry: { x: 0, y: 0, width: 16, height: 16 }
    }));
  });

  test("swaps the axis-perpendicular faces and mirrors U on the rest, for an X mirror", () => {
    const { blocks, uv } = createHarness();
    const block = blocks.add({ name: "Block" });
    const regionId = regionIdOf(block);
    uv.create({
      id: regionId,
      width: 16,
      height: 16,
      state: "free",
      activeSlots: DEFAULT_UV_SLOTS
    });
    uv.move(regionId, { x: 0, y: 0, width: 16, height: 16 }, "right");
    uv.move(regionId, { x: 100, y: 0, width: 16, height: 16 }, "left");
    uv.move(regionId, { x: 0, y: 100, width: 16, height: 16 }, "front");

    blocks.mirror([block.uuid], { x: true, y: false, z: false });

    assert.equal(uvOf(block, 0)[0], 100 / kTextureSize.x);
    assert.equal(uvOf(block, 1)[0], 116 / kTextureSize.x);
    assert.equal(uvOf(block, 16)[0], 16 / kTextureSize.x);
    assert.equal(uvOf(block, 17)[0], 0);
  });
});

describe("BlockTextures regions port", () => {
  test("create adds an unfolded region named after the block", () => {
    const { blocks, uv, textures } = createHarness();
    const block = blocks.add();

    textures.create(block.uuid, "Head");

    assert.equal(uv.get(regionIdOf(block))?.name, "Head");
    assert.equal(uv.get(regionIdOf(block))?.state, "unfolded");
  });

  test("copy clones the source region onto the duplicate", () => {
    const { blocks, uv, textures } = createHarness();
    const source = blocks.add({ name: "Block" });
    const duplicate = blocks.add({ name: "Block Copy" });
    uv.create({ id: regionIdOf(source), width: 16, height: 16 });
    uv.move(regionIdOf(source), { x: 64, y: 32, width: 16, height: 16 });

    textures.copy(source.uuid, duplicate.uuid, "Block Copy");

    assert.deepEqual(uvOf(duplicate, 1), [80 / kTextureSize.x, 1 - (32 / kTextureSize.y)]);
    assert.equal(uv.get(regionIdOf(duplicate))?.name, "Block Copy");
  });

  test("copy falls back to a default region when the source has none", () => {
    const { blocks, uv, textures } = createHarness();
    const source = blocks.add();
    const duplicate = blocks.add();

    textures.copy(source.uuid, duplicate.uuid, "Copy");

    assert.ok(uv.get(regionIdOf(duplicate)));
  });

  test("deletes a block's region when the block is removed", () => {
    const { blocks, uv, textures } = createHarness();
    const block = blocks.add();
    textures.create(block.uuid, "Block");

    blocks.remove(block.uuid);

    assert.equal(uv.get(regionIdOf(block)), undefined);
  });
});

describe("BlockTextures missing regions", () => {
  test("creates no region while the texture is still loading", () => {
    const ready = Promise.withResolvers<void>();
    const { document, uv } = createHarness(ready.promise);

    document.load(kTorsoSnapshot);

    assert.equal(uv.get(kTorsoRegionId), undefined);
  });

  test("creates and binds a region for a snapshot block that has none", async() => {
    const ready = Promise.withResolvers<void>();
    const { document, uv } = createHarness(ready.promise);
    document.load(kTorsoSnapshot);

    ready.resolve();
    await ready.promise;

    assert.equal(uv.get(kTorsoRegionId)?.name, "Torso");

    const block = document.blocks.get("torso");
    assert.ok(block);
    uv.move(kTorsoRegionId, { x: 0, y: 0, width: 48, height: 32 });
    const [u, v] = uvOf(block, 1);
    uv.move(kTorsoRegionId, { x: 64, y: 0, width: 48, height: 32 });

    assert.deepEqual(uvOf(block, 1), [u + (64 / kTextureSize.x), v]);
  });

  test("leaves the region the texture already carries untouched", async() => {
    const ready = Promise.withResolvers<void>();
    const { document, uv } = createHarness(ready.promise);
    uv.create({ id: kTorsoRegionId, width: 16, height: 16 });
    uv.move(kTorsoRegionId, { x: 64, y: 32, width: 16, height: 16 });
    ready.resolve();
    await ready.promise;

    document.load(kTorsoSnapshot);

    assert.deepEqual(
      uv.get(kTorsoRegionId)?.geometryFor("front"),
      { x: 64, y: 32, width: 16, height: 16 }
    );
  });
});

describe("BlockTextures rename", () => {
  test("a local block rename renames its region", () => {
    const { blocks, uv, textures } = createHarness();
    const block = blocks.add({ name: "Torso" });
    textures.create(block.uuid, block.name);
    uv.move(regionIdOf(block), { x: 32, y: 0, width: 16, height: 16 });
    const before = uv.get(regionIdOf(block))?.toJSON();
    assert.ok(before);

    blocks.rename(block.uuid, "Chest");

    assert.deepEqual(
      uv.get(regionIdOf(block))?.toJSON(),
      { ...before, name: "Chest" }
    );
  });

  test("keeps the renamed region mapped onto the mesh", () => {
    const { blocks, uv, textures } = createHarness();
    const block = blocks.add({ name: "Torso" });
    textures.create(block.uuid, block.name);
    blocks.rename(block.uuid, "Chest");

    uv.setState(regionIdOf(block), "stacked");
    uv.move(regionIdOf(block), { x: 32, y: 0, width: 16, height: 16 });

    assert.deepEqual(uvOf(block, 1), [48 / kTextureSize.x, 1]);
  });

  test("leaves a remote rename to the pixel document sync", () => {
    const { document, blocks, uv, textures } = createHarness();
    const block = blocks.add({ name: "Torso" });
    textures.create(block.uuid, block.name);

    document.apply({
      action: "group-renamed",
      uuid: block.uuid,
      name: "Chest"
    });

    assert.equal(block.name, "Chest");
    assert.equal(uv.get(regionIdOf(block))?.name, "Torso");
  });
});

describe("BlockTextures selection", () => {
  test("selecting a block selects its region, and the reverse", () => {
    const { blocks, uv, textures } = createHarness();
    const first = blocks.add();
    const second = blocks.add();
    textures.create(first.uuid, "First");
    textures.create(second.uuid, "Second");

    blocks.select(first);
    assert.equal(uv.selectedRegionId, regionIdOf(first));

    uv.select(regionIdOf(second));
    assert.equal(blocks.selected, second);
  });
});
